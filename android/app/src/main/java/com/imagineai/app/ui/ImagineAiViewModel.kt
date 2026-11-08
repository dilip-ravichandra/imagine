package com.imagineai.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.imagineai.app.model.MetricsSummaryResponse
import com.imagineai.app.model.MultiModelGenerateRequest
import com.imagineai.app.model.MultiModelGenerateResponse
import com.imagineai.app.model.PromptAnalysisRequest
import com.imagineai.app.model.PromptAnalysisResponse
import com.imagineai.app.model.StressGenerateRequest
import com.imagineai.app.model.StressGenerateResponse
import com.imagineai.app.network.ApiClient
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.IOException

data class UiState(
    val prompt: String = "A cozy wooden cabin beside a mountain lake at sunset",
    val resolution: Int = 512,
    val seedText: String = "42",
    val serverBaseUrl: String = ApiClient.baseUrl,
    val isLoading: Boolean = false,
    val isCheckingServer: Boolean = false,
    val serverAvailable: Boolean? = null,
    val lastResponse: MultiModelGenerateResponse? = null,
    val errorMessage: String? = null,
    val suggestedAction: String? = null,
    val canRetry: Boolean = false,
    val showConfigDialog: Boolean = false,
    val activeTab: String = "generate",
    val selectedModel: String = "sd15_adapted",
    val qualityPreset: String = "balanced",
    val latencyBudget: Float = 500f,
    val vramBudget: Float = 4060f,
    val failureFilter: String = "all",
    val selectedFailureId: Int = 5,
    // Live prompt analysis
    val promptAnalysis: PromptAnalysisResponse? = null,
    val isAnalyzingPrompt: Boolean = false,
    // Live adaptive stress testing
    val stressPrompt: String = "A cybernetic cheetah sprinting through a futuristic desert, cinematic",
    val isStressRunning: Boolean = false,
    val stressResponse: StressGenerateResponse? = null,
    val isBatchRunning: Boolean = false,
    val batchCompleted: Boolean = true,
    val metricsSummary: MetricsSummaryResponse? = null
)

class ImagineAiViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private var promptAnalysisJob: Job? = null

    init {
        checkServerHealth()
        fetchMetricsSummary()
        triggerPromptAnalysis(_uiState.value.prompt)
    }

    fun onTabChange(tab: String) {
        _uiState.update { it.copy(activeTab = tab) }
    }

    fun onModelChange(model: String) {
        _uiState.update { it.copy(selectedModel = model) }
    }

    fun onQualityPresetChange(preset: String) {
        _uiState.update { it.copy(qualityPreset = preset) }
    }

    fun onLatencyBudgetChange(budget: Float) {
        _uiState.update { it.copy(latencyBudget = budget) }
    }

    fun onVramBudgetChange(budget: Float) {
        _uiState.update { it.copy(vramBudget = budget) }
    }

    fun onFailureFilterChange(filter: String) {
        _uiState.update { it.copy(failureFilter = filter) }
    }

    fun onSelectFailure(id: Int) {
        _uiState.update { it.copy(selectedFailureId = id) }
    }

    fun onPromptChange(newPrompt: String) {
        if (newPrompt.length <= 500) {
            _uiState.update { it.copy(prompt = newPrompt, errorMessage = null) }
            triggerPromptAnalysis(newPrompt)
        }
    }

    fun onStressPromptChange(newPrompt: String) {
        if (newPrompt.length <= 500) {
            _uiState.update { it.copy(stressPrompt = newPrompt) }
        }
    }

    private fun triggerPromptAnalysis(text: String) {
        promptAnalysisJob?.cancel()
        if (text.isBlank()) {
            _uiState.update { it.copy(promptAnalysis = null) }
            return
        }

        promptAnalysisJob = viewModelScope.launch {
            delay(400) // debounce typing
            try {
                _uiState.update { it.copy(isAnalyzingPrompt = true) }
                val resp = ApiClient.getApi().analyzePrompt(PromptAnalysisRequest(prompt = text.trim()))
                if (resp.isSuccessful && resp.body() != null) {
                    _uiState.update { it.copy(promptAnalysis = resp.body(), isAnalyzingPrompt = false) }
                } else {
                    _uiState.update { it.copy(isAnalyzingPrompt = false) }
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isAnalyzingPrompt = false) }
            }
        }
    }

    fun onResolutionChange(res: Int) {
        _uiState.update { it.copy(resolution = res) }
    }

    fun onSeedChange(seed: String) {
        if (seed.isEmpty() || seed.all { it.isDigit() }) {
            _uiState.update { it.copy(seedText = seed) }
        }
    }

    fun onBaseUrlChange(url: String) {
        ApiClient.baseUrl = url
        _uiState.update { it.copy(serverBaseUrl = ApiClient.baseUrl) }
        checkServerHealth()
    }

    fun toggleConfigDialog(show: Boolean) {
        _uiState.update { it.copy(showConfigDialog = show) }
    }

    fun checkServerHealth() {
        viewModelScope.launch {
            _uiState.update { it.copy(isCheckingServer = true) }
            try {
                val resp = ApiClient.getApi().health()
                val ok = resp.status.equals("ok", ignoreCase = true)
                _uiState.update { it.copy(serverAvailable = ok, isCheckingServer = false) }
            } catch (_: Exception) {
                _uiState.update { it.copy(serverAvailable = false, isCheckingServer = false) }
            }
        }
    }

    fun generateImage() {
        val prompt = _uiState.value.prompt.trim()
        if (prompt.isEmpty()) {
            _uiState.update {
                it.copy(
                    errorMessage = "Prompt cannot be empty.",
                    suggestedAction = "Enter a descriptive text prompt between 1 and 500 characters.",
                    canRetry = false
                )
            }
            return
        }

        val seedValue = _uiState.value.seedText.toLongOrNull()
        val targetSteps = when (_uiState.value.qualityPreset) {
            "quick" -> 1
            "best" -> 4
            else -> if (_uiState.value.selectedModel == "sd15_adapted" || _uiState.value.selectedModel == "sd15_baseline") 30 else 2
        }

        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = true,
                    errorMessage = null,
                    suggestedAction = null,
                    canRetry = false
                )
            }

            try {
                val req = MultiModelGenerateRequest(
                    prompt = prompt,
                    resolution = _uiState.value.resolution,
                    seed = seedValue,
                    modelChoice = _uiState.value.selectedModel,
                    steps = targetSteps
                )

                val response = ApiClient.getApi().generateAdapted(req)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            lastResponse = body,
                            errorMessage = null,
                            suggestedAction = null,
                            serverAvailable = true
                        )
                    }
                } else {
                    val errorObj = ApiClient.parseErrorBody(response)?.error
                    val message = errorObj?.message ?: "Server returned error code ${response.code()}."
                    val action = errorObj?.suggestedAction ?: "Check connection and try again."
                    val retryable = errorObj?.retryable ?: (response.code() in listOf(429, 503))

                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = message,
                            suggestedAction = action,
                            canRetry = retryable
                        )
                    }
                }
            } catch (e: IOException) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = "Cannot reach generation server: ${e.localizedMessage ?: "Network error"}",
                        suggestedAction = "For the Android emulator use http://10.0.2.2:8080/. Keep the laptop backend running on port 8080.",
                        canRetry = true,
                        serverAvailable = false
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = "Unexpected error: ${e.localizedMessage ?: "Unknown error"}",
                        suggestedAction = "Retry with different parameters.",
                        canRetry = true
                    )
                }
            }
        }
    }

    fun runLiveStressTest() {
        val prompt = _uiState.value.stressPrompt.ifBlank {
            _uiState.value.prompt.ifBlank { "A cybernetic cheetah sprinting through a futuristic desert, cinematic" }
        }
        viewModelScope.launch {
            _uiState.update { it.copy(isStressRunning = true) }
            try {
                val req = StressGenerateRequest(
                    prompt = prompt,
                    latencyBudgetMs = _uiState.value.latencyBudget.toInt(),
                    vramBudgetMb = _uiState.value.vramBudget.toInt(),
                    modelChoice = _uiState.value.selectedModel
                )
                val resp = ApiClient.getApi().stressGenerate(req)
                if (resp.isSuccessful && resp.body() != null) {
                    _uiState.update { it.copy(isStressRunning = false, stressResponse = resp.body()) }
                } else {
                    _uiState.update { it.copy(isStressRunning = false) }
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isStressRunning = false) }
            }
        }
    }

    fun fetchMetricsSummary() {
        viewModelScope.launch {
            try {
                val resp = ApiClient.getApi().metricsSummary()
                if (resp.isSuccessful && resp.body() != null) {
                    _uiState.update { it.copy(metricsSummary = resp.body()) }
                }
            } catch (_: Exception) {}
        }
    }

    fun runHoldoutSuite() {
        viewModelScope.launch {
            _uiState.update { it.copy(isBatchRunning = true) }
            fetchMetricsSummary()
            delay(1200) // evaluation sweep simulation
            _uiState.update { it.copy(isBatchRunning = false, batchCompleted = true) }
        }
    }
}
