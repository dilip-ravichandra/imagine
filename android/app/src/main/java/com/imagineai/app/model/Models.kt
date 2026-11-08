package com.imagineai.app.model

import com.google.gson.annotations.SerializedName

enum class QualityMode(val apiValue: String, val displayName: String, val stepsHint: String) {
    QUICK("quick", "Quick", "1 step · Fast draft"),
    BALANCED("balanced", "Balanced", "2 steps · Recommended"),
    BEST("best", "Best", "4 steps · Maximum detail")
}

data class GenerateRequest(
    @SerializedName("prompt") val prompt: String,
    @SerializedName("quality_mode") val qualityMode: String = "balanced",
    @SerializedName("resolution") val resolution: Int = 512,
    @SerializedName("seed") val seed: Long? = null
)

data class MultiModelGenerateRequest(
    @SerializedName("prompt") val prompt: String,
    @SerializedName("model_choice") val modelChoice: String = "sd15_adapted",
    @SerializedName("resolution") val resolution: Int = 512,
    @SerializedName("seed") val seed: Long? = null,
    @SerializedName("steps") val steps: Int = 30
)

data class MultiModelGenerateResponse(
    @SerializedName("status") val status: String,
    @SerializedName("request_id") val requestId: String? = null,
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("model") val model: String? = null,
    @SerializedName("model_choice") val modelChoice: String? = null,
    @SerializedName("precision") val precision: String? = null,
    @SerializedName("steps") val steps: Int? = null,
    @SerializedName("seed") val seed: Long? = null,
    @SerializedName("resolution") val resolution: Int? = null,
    @SerializedName("latency_ms") val latencyMs: Double? = null,
    @SerializedName("peak_gpu_mb") val peakGpuMb: Double? = null,
    @SerializedName("adapter_weight") val adapterWeight: Double? = null
) {
    val generationDetails: GenerationDetails?
        get() = model?.let {
            GenerationDetails(
                model = it,
                modelRevision = "${modelChoice ?: "sd15_adapted"} · LoRA weight ${adapterWeight ?: 0.25}",
                precision = precision ?: "fp16",
                scheduler = "SD 1.5 default scheduler",
                steps = steps ?: 30,
                width = resolution ?: 512,
                height = resolution ?: 512,
                seed = seed ?: 0L
            )
        }

    val performanceMetrics: PerformanceMetrics?
        get() = if (latencyMs != null || peakGpuMb != null) {
            PerformanceMetrics(endToEndMs = latencyMs, peakGpuMb = peakGpuMb)
        } else null

    val resourceDecision: ResourceDecision
        get() = ResourceDecision(
            fallbackUsed = false,
            explanation = "Approved SD 1.5 Adaptive LoRA on the laptop GPU at weight ${adapterWeight ?: 0.25}; ${steps ?: 30} steps."
        )
}

data class StressGenerateRequest(
    @SerializedName("prompt") val prompt: String,
    @SerializedName("latency_budget_ms") val latencyBudgetMs: Int,
    @SerializedName("vram_budget_mb") val vramBudgetMb: Int,
    @SerializedName("model_choice") val modelChoice: String? = "sd_turbo",
    @SerializedName("seed") val seed: Long? = null
)

data class StressGenerateResponse(
    @SerializedName("status") val status: String,
    @SerializedName("request_id") val requestId: String? = null,
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("executed_latency_ms") val executedLatencyMs: Double? = null,
    @SerializedName("latency_budget_ms") val latencyBudgetMs: Int? = null,
    @SerializedName("budget_met") val budgetMet: Boolean? = null,
    @SerializedName("executed_vram_mb") val executedVramMb: Double? = null,
    @SerializedName("peak_vram_mb") val peakVramMb: Double? = null,
    @SerializedName("vram_budget_mb") val vramBudgetMb: Int? = null,
    @SerializedName("model_choice") val modelChoice: String? = null,
    @SerializedName("chosen_resolution") val chosenResolution: Int? = null,
    @SerializedName("chosen_steps") val chosenSteps: Int? = null,
    @SerializedName("chosen_precision") val chosenPrecision: String? = null,
    @SerializedName("ladder_step") val ladderStep: Int? = null,
    @SerializedName("ladder_name") val ladderName: String? = null,
    @SerializedName("explanation") val explanation: String? = null,
    @SerializedName("controller_decision") val controllerDecision: String? = null,
    @SerializedName("budget_status") val budgetStatus: String? = null
)

data class PromptAnalysisRequest(
    @SerializedName("prompt") val prompt: String
)

data class ParsedObject(
    @SerializedName("canonical") val canonical: String? = null,
    @SerializedName("count") val count: Int? = 1,
    @SerializedName("modifiers") val modifiers: List<String> = emptyList()
)

data class ParsedItem(
    @SerializedName("canonical") val canonical: String? = null
)

data class MetricsSummaryResponse(
    @SerializedName("environment") val environment: Map<String, Any>? = null,
    @SerializedName("summary_cards") val summaryCards: SummaryCards? = null
)

data class SummaryCards(
    @SerializedName("best_clip_alignment") val bestClipAlignment: Double? = null,
    @SerializedName("inference_speedup_x") val inferenceSpeedupX: Double? = null,
    @SerializedName("baseline_latency_ms") val baselineLatencyMs: Double? = null,
    @SerializedName("vram_reduction_pct") val vramReductionPct: Double? = null,
    @SerializedName("fastest_e2e_ms") val fastestE2eMs: Double? = null,
    @SerializedName("cv_overhead_ms") val cvOverheadMs: Double? = null
)

data class PromptAnalysisResponse(
    @SerializedName("objects") val objects: List<ParsedObject> = emptyList(),
    @SerializedName("environment") val environment: List<ParsedItem> = emptyList(),
    @SerializedName("lighting") val lighting: List<ParsedItem> = emptyList(),
    @SerializedName("style") val style: List<ParsedItem> = emptyList()
)

data class GenerateResponse(
    @SerializedName("status") val status: String,
    @SerializedName("request_id") val requestId: String? = null,
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("generation") val generation: GenerationDetails? = null,
    @SerializedName("performance") val performance: PerformanceMetrics? = null,
    @SerializedName("quality") val quality: QualityMetrics? = null,
    @SerializedName("resource_decision") val resourceDecision: ResourceDecision? = null,
    @SerializedName("error") val error: ApiError? = null
)

data class GenerationDetails(
    @SerializedName("model") val model: String,
    @SerializedName("model_revision") val modelRevision: String,
    @SerializedName("precision") val precision: String,
    @SerializedName("scheduler") val scheduler: String,
    @SerializedName("steps") val steps: Int,
    @SerializedName("width") val width: Int,
    @SerializedName("height") val height: Int,
    @SerializedName("seed") val seed: Long
)

data class PerformanceMetrics(
    @SerializedName("model_load_ms") val modelLoadMs: Double? = null,
    @SerializedName("prompt_encode_ms") val promptEncodeMs: Double? = null,
    @SerializedName("denoise_ms") val denoiseMs: Double? = null,
    @SerializedName("decode_ms") val decodeMs: Double? = null,
    @SerializedName("cv_ms") val cvMs: Double? = null,
    @SerializedName("end_to_end_ms") val endToEndMs: Double? = null,
    @SerializedName("peak_gpu_mb") val peakGpuMb: Double? = null,
    @SerializedName("peak_process_ram_mb") val peakProcessRamMb: Double? = null
)

data class QualityMetrics(
    @SerializedName("clip_score") val clipScore: Double? = null,
    @SerializedName("sharpness") val sharpness: Double? = null,
    @SerializedName("brightness") val brightness: Double? = null,
    @SerializedName("contrast") val contrast: Double? = null,
    @SerializedName("artifact_flags") val artifactFlags: List<String>? = null
)

data class ResourceDecision(
    @SerializedName("fallback_used") val fallbackUsed: Boolean = false,
    @SerializedName("reason") val reason: String? = null,
    @SerializedName("explanation") val explanation: String? = null
)

data class ApiError(
    @SerializedName("code") val code: String,
    @SerializedName("message") val message: String,
    @SerializedName("retryable") val retryable: Boolean = false,
    @SerializedName("suggested_action") val suggestedAction: String? = null
)

data class ErrorResponse(
    @SerializedName("status") val status: String,
    @SerializedName("request_id") val requestId: String? = null,
    @SerializedName("error") val error: ApiError
)

data class CapabilitiesResponse(
    @SerializedName("api_version") val apiVersion: String,
    @SerializedName("quality_modes") val qualityModes: List<String>,
    @SerializedName("min_resolution") val minResolution: Int,
    @SerializedName("max_resolution") val maxResolution: Int,
    @SerializedName("generation_available") val generationAvailable: Boolean,
    @SerializedName("deployment_mode") val deploymentMode: String
)

data class HealthResponse(
    @SerializedName("status") val status: String,
    @SerializedName("api_version") val apiVersion: String
)
