package com.imagineai.app.network

import com.google.gson.Gson
import com.imagineai.app.BuildConfig
import com.imagineai.app.model.CapabilitiesResponse
import com.imagineai.app.model.ErrorResponse
import com.imagineai.app.model.HealthResponse
import com.imagineai.app.model.MetricsSummaryResponse
import com.imagineai.app.model.MultiModelGenerateRequest
import com.imagineai.app.model.MultiModelGenerateResponse
import com.imagineai.app.model.PromptAnalysisRequest
import com.imagineai.app.model.PromptAnalysisResponse
import com.imagineai.app.model.StressGenerateRequest
import com.imagineai.app.model.StressGenerateResponse
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

interface ImagineAiApi {
    @GET("health")
    suspend fun health(): HealthResponse

    @GET("api/v1/capabilities")
    suspend fun capabilities(): CapabilitiesResponse

    @GET("api/v1/metrics/summary")
    suspend fun metricsSummary(): Response<MetricsSummaryResponse>

    @POST("api/v1/generate/multimodel")
    suspend fun generateAdapted(@Body request: MultiModelGenerateRequest): Response<MultiModelGenerateResponse>

    @POST("api/v1/adaptive/stress-generate")
    suspend fun stressGenerate(@Body request: StressGenerateRequest): Response<StressGenerateResponse>

    @POST("api/v1/prompt/analysis")
    suspend fun analyzePrompt(@Body request: PromptAnalysisRequest): Response<PromptAnalysisResponse>
}

object ApiClient {
    private val gson = Gson()
    private var customBaseUrl: String? = null
    private var customApiKey: String? = null

    var baseUrl: String
        get() = customBaseUrl ?: BuildConfig.BASE_URL
        set(value) {
            customBaseUrl = if (value.endsWith("/")) value else "$value/"
            apiInstance = null
        }

    var apiKey: String
        get() = customApiKey ?: BuildConfig.API_KEY
        set(value) {
            customApiKey = value
            apiInstance = null
        }

    private var apiInstance: ImagineAiApi? = null

    fun getApi(): ImagineAiApi {
        return apiInstance ?: synchronized(this) {
            apiInstance ?: buildRetrofit().create(ImagineAiApi::class.java).also {
                apiInstance = it
            }
        }
    }

    private fun buildRetrofit(): Retrofit {
        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val builder = original.newBuilder()
            val key = apiKey
            if (key.isNotBlank()) {
                builder.header("X-API-Key", key)
            }
            chain.proceed(builder.build())
        }

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(300, TimeUnit.SECONDS)  // First request loads model pipelines
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }

    fun parseErrorBody(response: Response<*>): ErrorResponse? {
        val errorString = response.errorBody()?.string() ?: return null
        return try {
            gson.fromJson(errorString, ErrorResponse::class.java)
        } catch (_: Exception) {
            null
        }
    }
}
