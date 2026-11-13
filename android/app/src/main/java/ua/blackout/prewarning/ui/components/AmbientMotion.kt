package ua.blackout.prewarning.ui.components

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.withFrameMillis
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * The page change of the main pager (nav-bar taps and the snap after a swipe): critically damped, so it
 * glides without overshoot (the web simulator uses the same stiffness and damping).
 */
val PageGlide = spring<Float>(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = 300f)

/** True when the user turned animations off (Developer options or Accessibility "Remove animations"). */
fun reducedMotion(context: Context): Boolean = try {
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
} catch (_: Exception) {
    false
}

/**
 * Seconds since the screen appeared, for the very slow background warp. Updated about 15 times a
 * second: the orbs move a fraction of a dp per update, so it looks continuous at a fraction of the cost
 * of every frame. The frame clock pauses while the app is not visible, so the loop pauses with it.
 * Under reduced motion it stays at 0 (no drift).
 */
@Composable
fun rememberAmbientSeconds(): State<Float> {
    val context = LocalContext.current
    val reduced = remember { reducedMotion(context) }
    val seconds = remember { mutableFloatStateOf(0f) }
    if (!reduced) {
        LaunchedEffect(Unit) {
            val start = withFrameMillis { it }
            while (true) {
                delay(66)
                val now = withFrameMillis { it }
                seconds.floatValue = (now - start) / 1000f
            }
        }
    }
    return seconds
}

/**
 * One background orb's slow drift: a Lissajous path of [amplitude] (a fraction of the screen width or
 * height) on incommensurate periods, so the background never visibly repeats. [seed] gives each orb its
 * own periods and phase.
 */
fun ambientDrift(seconds: Float, seed: Int, width: Float, height: Float, amplitude: Float = 0.06f): Offset {
    val px = PERIODS[seed % PERIODS.size]
    val py = PERIODS[(seed + 2) % PERIODS.size]
    val phase = seed * 1.7f
    val tau = 2f * PI.toFloat()
    return Offset(
        x = width * amplitude * sin(tau * seconds / px + phase),
        y = height * amplitude * 0.7f * cos(tau * seconds / py + phase * 0.6f)
    )
}

/** Slow "breathing" of an orb's radius, within +-5 %. */
fun ambientBreath(seconds: Float, seed: Int): Float {
    val p = PERIODS[(seed + 1) % PERIODS.size] * 1.3f
    return 1f + 0.05f * sin(2f * PI.toFloat() * seconds / p + seed)
}

private val PERIODS = floatArrayOf(47f, 61f, 53f, 71f, 59f)
