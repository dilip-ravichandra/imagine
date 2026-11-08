package com.imagineai.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.imagineai.app.ui.ImagineAiScreen
import com.imagineai.app.ui.ImagineAiViewModel

private val ImagineAiColorScheme = darkColorScheme(
    primary          = Color(0xFF8B5CF6),
    onPrimary        = Color.White,
    background       = Color(0xFF090C17),
    onBackground     = Color(0xFFF8FAFC),
    surface          = Color(0xFF101426),
    onSurface        = Color(0xFFF8FAFC),
    surfaceVariant   = Color(0xFF141930),
    onSurfaceVariant = Color(0xFF94A3B8),
    error            = Color(0xFFF43F5E),
    onError          = Color.White,
)

class MainActivity : ComponentActivity() {
    private val viewModel: ImagineAiViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = ImagineAiColorScheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color    = Color(0xFF090C17)
                ) {
                    ImagineAiScreen(viewModel = viewModel)
                }
            }
        }
    }
}
