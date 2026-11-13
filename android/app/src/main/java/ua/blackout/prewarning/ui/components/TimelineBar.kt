package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtType
import kotlin.math.floor
import kotlin.math.sqrt

/** One half-hour cell of the drum, reduced to what is drawn. */
private data class DrumCell(val planned: Boolean, val emergency: Boolean)

/**
 * 48 cells from [slots]: 48 half-hour slots, or 24 hourly slots (legacy, each used twice). Anything
 * else yields null and the drum shows the grey "unclear" bar. `isPlanned` and `isEmergency` are
 * separate so a planned outage overlapped by an emergency one shows both (spec/UI_DRUM.md section 1).
 */
private fun drumCells(slots: List<BlackoutSlot>): List<DrumCell>? {
    val src = when (slots.size) {
        48 -> slots
        24 -> slots.flatMap { listOf(it, it) }
        else -> return null
    }
    return src.map { s ->
        val off = s.status == SlotStatus.POWER_OFF
        DrumCell(
            planned = off && (s.isPlanned || !s.isEmergency),
            emergency = off && s.isEmergency
        )
    }
}

// Needle and track share one inset: 6 dp slot padding + 2 dp slot border.
private val TrackInset = 8.dp
private val HourGap = 1.5.dp
private val CellHeight = 32.dp

/** Stripe geometry: 3 dp stripe + 3 dp gap measured across the stripe, at 45 degrees. */
private val StripeWidth = 3.dp
private val StripePeriod = 6.dp

/**
 * The 24-hour "analog meter" drum. Planned and repair outages are crimson, emergency outages are amber
 * with 45 degree stripes (second cue besides colour), emergency over planned is crimson with amber
 * stripes. [unclearBase] paints cells without an outage grey (the day's table is not known) while
 * outages that are known (emergency, repair) are still drawn on top.
 *
 * The 48 cells are drawn in one Canvas so the stripe pattern is continuous across neighbouring
 * cells; the whole drum is one TalkBack element described by [OutageRowFormat.drumSummary].
 */
@Composable
fun TimelineBar(
    slots: List<BlackoutSlot>,
    currentHour: Int = 12,
    currentMinute: Int = 0,
    showNeedle: Boolean = true,
    lang: String = "uk",
    modifier: Modifier = Modifier,
    unclearBase: Boolean = false
) {
    val faceplateBrush = remember {
        Brush.verticalGradient(listOf(Color(0xFFDFDDD0), Color(0xFFD4D1C1), Color(0xFFC6C2B0)))
    }
    val offBlockBrush = remember {
        Brush.verticalGradient(listOf(Color(0xFF9E1E18), Color(0xFFD62E26), Color(0xFF8C1914)))
    }
    val onBlockBrush = remember {
        Brush.verticalGradient(listOf(Color(0xFFD8D6CC), Color(0xFFFCFBF7), Color(0xFFCCC9BE)))
    }
    val unclearBlockBrush = remember {
        Brush.verticalGradient(listOf(Color(0xFF7E8287), Color(0xFF94989E), Color(0xFF6E7277)))
    }
    val emergencyBlockBrush = remember {
        Brush.verticalGradient(
            listOf(ZtColors.EmergencyAmberStart, ZtColors.EmergencyAmberMid, ZtColors.EmergencyAmberEnd)
        )
    }

    val cells = remember(slots) { drumCells(slots) }
    val summary = remember(slots, lang, unclearBase) { OutageRowFormat.drumSummary(lang, slots, unclearBase) }
    val fontScale = LocalDensity.current.fontScale
    // Tick labels are 12 sp at the least; above 1.3x font scale only every 4 h so they cannot overlap.
    val markers = remember(fontScale > 1.3f) {
        if (fontScale > 1.3f) listOf(0, 4, 8, 12, 16, 20, 24) else listOf(0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24)
    }

    // Outer analog electricity meter (САЗУ-ИТ) enamel beige faceplate
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clearAndSetSemantics { contentDescription = summary }
            .clip(RoundedCornerShape(16.dp))
            .background(faceplateBrush)
            .border(2.dp, Color(0xFF7A7768), RoundedCornerShape(16.dp))
            .padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 10.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Wrapper with 4.dp top/bottom padding so the black needle protrudes 4.dp above and below the dark-grey contour
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
                    .drawWithContent {
                        drawContent()
                        if (showNeedle) {
                            val inset = TrackInset.toPx()
                            val gap = HourGap.toPx()
                            val track = (size.width - inset * 2f).coerceAtLeast(1f)
                            val hourW = (track - gap * 23f) / 24f
                            val hour = currentHour.coerceIn(0, 23)
                            val minuteFraction = currentMinute.coerceIn(0, 59) / 60f
                            // Exact position inside the hour cell, so the 1.5 dp hour gaps do not skew the needle
                            val centerX = inset + hour * (hourW + gap) + minuteFraction * hourW
                            val needleW = 3.dp.toPx()
                            val haloW = 4.5.dp.toPx()

                            // Subtle light halo so the black needle stands out against both red and dark-grey edges
                            drawRoundRect(
                                color = Color(0xD9FFFFFF),
                                topLeft = Offset(centerX - haloW / 2f, 0f),
                                size = Size(haloW, size.height),
                                cornerRadius = CornerRadius(haloW / 2f, haloW / 2f)
                            )
                            // Crisp black needle protruding 4.dp above and below the dark-grey contour
                            drawRoundRect(
                                color = Color(0xFF0B0B0A),
                                topLeft = Offset(centerX - needleW / 2f, 0f),
                                size = Size(needleW, size.height),
                                cornerRadius = CornerRadius(needleW / 2f, needleW / 2f)
                            )
                        }
                    }
            ) {
                // Recessed metallic dark-grey counter drum slot (#4E514E) with #6E716B border
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF4E514E))
                        .border(2.dp, Color(0xFF6E716B), RoundedCornerShape(8.dp))
                        .padding(6.dp)
                ) {
                    if (cells == null) {
                        // Grey drum with "Графіки не діють" / "Outages unclear": nothing is known for this queue
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = CellHeight)
                                .clip(RoundedCornerShape(2.dp))
                                .background(unclearBlockBrush)
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = AppStrings.outagesUnclear(lang),
                                style = ZtType.label.copy(fontWeight = FontWeight.ExtraBold),
                                color = Color.White,
                                maxLines = 2
                            )
                        }
                    } else {
                        Canvas(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(CellHeight)
                                .clip(RoundedCornerShape(2.dp))
                        ) {
                            // 1.5dp light-gray (#C8C6BC) hour separators show through as the background
                            drawRect(Color(0xFFC8C6BC))
                            val gap = HourGap.toPx()
                            val hourW = (size.width - gap * 23f) / 24f
                            val halfW = hourW / 2f
                            val h = size.height
                            val period = StripePeriod.toPx() * sqrt(2f)
                            val stripe = StripeWidth.toPx()

                            for (i in 0 until 48) {
                                val cell = cells[i]
                                val left = (i / 2) * (hourW + gap) + (i % 2) * halfW
                                val brush = when {
                                    cell.planned -> offBlockBrush
                                    cell.emergency -> emergencyBlockBrush
                                    unclearBase -> unclearBlockBrush
                                    else -> onBlockBrush
                                }
                                // Two 30-min cells of one hour touch (no half-hour separator); +0.5 px hides the seam
                                val width = halfW + if (i % 2 == 0) 0.5f else 0f
                                drawRect(brush, topLeft = Offset(left, 0f), size = Size(width, h))
                                if (cell.emergency) {
                                    drawStripes(
                                        left = left,
                                        right = left + width,
                                        color = if (cell.planned) ZtColors.EmergencyStripeLight else ZtColors.EmergencyStripeDark,
                                        stripeWidth = stripe,
                                        period = period
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(2.dp))

            // Stamped black tick marks and numbers every 2 hours: 00, 02..24 (every 4 h at large font scale)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                markers.forEach { hour ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .width(1.5.dp)
                                .height(5.dp)
                                .background(Color(0xFF1C1B18))
                        )
                        Text(
                            text = hour.toString().padStart(2, '0'),
                            style = ZtType.overline.copy(fontFamily = FontFamily.Monospace, letterSpacing = 0.sp),
                            color = Color(0xFF1C1B18),
                            maxLines = 1,
                            softWrap = false,
                            modifier = Modifier.padding(top = 1.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * 45 degree stripes inside [left, right]. The pattern is anchored to the drum's x origin (stripe
 * starts are multiples of [period]), so adjacent emergency cells continue each other's stripes.
 */
private fun DrawScope.drawStripes(left: Float, right: Float, color: Color, stripeWidth: Float, period: Float) {
    val h = size.height
    clipRect(left = left, top = 0f, right = right, bottom = h) {
        var x = floor((left - h) / period) * period
        while (x < right) {
            drawLine(
                color = color,
                start = Offset(x, h),
                end = Offset(x + h, 0f),
                strokeWidth = stripeWidth
            )
            x += period
        }
    }
}
