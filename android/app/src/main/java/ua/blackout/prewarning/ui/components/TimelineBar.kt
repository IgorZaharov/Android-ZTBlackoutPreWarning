package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.parser.ZtoeParser
import java.time.LocalDate

@Composable
fun TimelineBar(
    slots: List<BlackoutSlot> = remember { ZtoeParser.generateFallbackSchedule("1.1", LocalDate.now().toString()) },
    currentHour: Int = 12,
    currentMinute: Int = 0,
    showNeedle: Boolean = true,
    modifier: Modifier = Modifier,
    onHourClick: (Int) -> Unit = {}
) {
    val faceplateBrush = remember {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFFDFDDD0),
                Color(0xFFD4D1C1),
                Color(0xFFC6C2B0)
            )
        )
    }
    val offBlockBrush = remember {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFF9E1E18),
                Color(0xFFD62E26),
                Color(0xFF8C1914)
            )
        )
    }
    val onBlockBrush = remember {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFFD8D6CC),
                Color(0xFFFCFBF7),
                Color(0xFFCCC9BE)
            )
        )
    }

    // Outer analog electricity meter (САЗУ-ИТ) enamel beige faceplate
    Box(
        modifier = modifier
            .fillMaxWidth()
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
                            val padPx = 6.dp.toPx()
                            val trackWidth = (size.width - padPx * 2f).coerceAtLeast(1f)
                            val totalMinutes = (currentHour.coerceIn(0, 23) * 60 + currentMinute.coerceIn(0, 59)).toFloat()
                            val fraction = (totalMinutes / 1440f).coerceIn(0f, 1f)
                            val centerX = padPx + trackWidth * fraction
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
                    // 24 Hours with 1.5dp light-gray (#C8C6BC) hour separators and 0dp half-hour separators
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color(0xFFC8C6BC)),
                        horizontalArrangement = Arrangement.spacedBy(1.5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val is48Slots = slots.size >= 48
                        (0 until 24).forEach { hour ->
                            val half1Off = if (is48Slots) {
                                slots.getOrNull(hour * 2)?.status == SlotStatus.POWER_OFF
                            } else {
                                slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
                            }
                            val half2Off = if (is48Slots) {
                                slots.getOrNull(hour * 2 + 1)?.status == SlotStatus.POWER_OFF
                            } else {
                                slots.getOrNull(hour)?.status == SlotStatus.POWER_OFF
                            }

                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { onHourClick(hour) }
                            ) {
                                // Two 30-min cylindrical blocks for this hour with NO half-hour separator
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(0.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    // Half 1: XX:00 - XX:30
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(32.dp)
                                            .background(if (half1Off) offBlockBrush else onBlockBrush)
                                    )
                                    // Half 2: XX:30 - (XX+1):00
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(32.dp)
                                            .background(if (half2Off) offBlockBrush else onBlockBrush)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(2.dp))

            // Stamped black tick marks and numbers every 2 hours: 00, 02..24
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                val markers = listOf(0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24)
                markers.forEach { h ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .width(1.5.dp)
                                .height(5.dp)
                                .background(Color(0xFF1C1B18))
                        )
                        Text(
                            text = String.format("%02d", h),
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1C1B18),
                            modifier = Modifier.padding(top = 1.dp)
                        )
                    }
                }
            }
        }
    }
}
