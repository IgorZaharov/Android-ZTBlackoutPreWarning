package ua.blackout.prewarning.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import java.time.LocalTime
import java.time.ZoneId

data class TimeOfDayColors(
    val primary: Color,    // 60% weight
    val secondary: Color,  // 30% weight
    val accent: Color,     // 10% weight
    val supporting: Color  // Text/Core or Supporting/UI
)

object TimeOfDayPalette {
    // Morning
    // • Primary (60%): #F4F9F9 (Soft Morning Mist / Light Neutral Background)
    // • Secondary (30%): #4A7C59 (Fresh Mint Green)
    // • Accent (10%): #FFB085 (Early Sunrise Peach)
    // • Text/Core: #2C3E35 (Deep Sage Dark Accent)
    val MORNING = TimeOfDayColors(
        primary = Color(0xFFF4F9F9),
        secondary = Color(0xFF4A7C59),
        accent = Color(0xFFFFB085),
        supporting = Color(0xFF2C3E35)
    )

    // Day
    // • Primary (60%): #FFFFFF (Crisp White Base)
    // • Secondary (30%): #0A2540 (Deep Noon Sky Navy)
    // • Accent (10%): #FFD166 (Direct Sunlight Yellow)
    // • Supporting/UI: #4682B4 (Bright Sky Blue)
    val DAY = TimeOfDayColors(
        primary = Color(0xFFFFFFFF),
        secondary = Color(0xFF0A2540),
        accent = Color(0xFFFFD166),
        supporting = Color(0xFF4682B4)
    )

    // Evening
    // • Primary (60%): #1A0B2E (Twilight Indigo / Dark Mode Base)
    // • Secondary (30%): #8B3A62 (Deep Magenta Sunset)
    // • Accent (10%): #FF6B6B (Golden Hour Coral)
    // • Supporting/UI: #FFE66D (Warm Amber Highlights)
    val EVENING = TimeOfDayColors(
        primary = Color(0xFF1A0B2E),
        secondary = Color(0xFF8B3A62),
        accent = Color(0xFFFF6B6B),
        supporting = Color(0xFFFFE66D)
    )

    // Night
    // • Primary (60%): #0B0C10 (Obsidian Midnight / True Black)
    // • Secondary (30%): #1F2833 (Deep Slate Shadow)
    // • Accent (10%): #66FCF1 (Neon Star Cyan / High-Contrast Interactive Elements)
    // • Supporting/UI: #C5C6C7 (Moonlight Silver Gray)
    val NIGHT = TimeOfDayColors(
        primary = Color(0xFF0B0C10),
        secondary = Color(0xFF1F2833),
        accent = Color(0xFF66FCF1),
        supporting = Color(0xFFC5C6C7)
    )

    private data class Anchor(val hour: Float, val colors: TimeOfDayColors)

    private val anchors = listOf(
        Anchor(2.0f, NIGHT),
        Anchor(8.5f, MORNING),
        Anchor(14.5f, DAY),
        Anchor(20.0f, EVENING),
        Anchor(26.0f, NIGHT)
    )

    fun getInterpolatedColors(time: LocalTime = LocalTime.now(ZoneId.of("Europe/Kyiv"))): TimeOfDayColors {
        val h = time.hour + (time.minute / 60f) + (time.second / 3600f)
        val adjustedH = if (h < 2.0f) h + 24.0f else h

        var from = anchors[0]
        var to = anchors[1]
        for (i in 0 until anchors.size - 1) {
            if (adjustedH >= anchors[i].hour && adjustedH <= anchors[i + 1].hour) {
                from = anchors[i]
                to = anchors[i + 1]
                break
            }
        }

        val span = to.hour - from.hour
        val rawT = if (span > 0f) ((adjustedH - from.hour) / span).coerceIn(0f, 1f) else 0f
        val smoothT = rawT * rawT * (3f - 2f * rawT)

        return TimeOfDayColors(
            primary = lerp(from.colors.primary, to.colors.primary, smoothT),
            secondary = lerp(from.colors.secondary, to.colors.secondary, smoothT),
            accent = lerp(from.colors.accent, to.colors.accent, smoothT),
            supporting = lerp(from.colors.supporting, to.colors.supporting, smoothT)
        )
    }
}
