package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
    slots: List<BlackoutSlot> = remember { ZtoeParser.generateFallbackSchedule("2.1", LocalDate.now().toString()) },
    currentHour: Int = 12,
    currentMinute: Int = 0,
    modifier: Modifier = Modifier,
    onHourClick: (BlackoutSlot) -> Unit = {}
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF18181A))
            .padding(horizontal = 10.dp, vertical = 12.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // 24 Hours, each containing two 30-min vertical rectangular blocks
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(3.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                slots.forEach { slot ->
                    val isOff = slot.status == SlotStatus.POWER_OFF
                    val isCurrentHour = slot.startHour == currentHour

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onHourClick(slot) }
                    ) {
                        // Two 30-min blocks for this hour
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(1.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Half 1: XX:00 - XX:30
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(32.dp)
                                    .clip(RoundedCornerShape(1.dp))
                                    .background(if (isOff) Color(0xFFDC3C32) else Color(0xFF373737))
                            )
                            // Half 2: XX:30 - (XX+1):00
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(32.dp)
                                    .clip(RoundedCornerShape(1.dp))
                                    .background(if (isOff) Color(0xFFDC3C32) else Color(0xFF373737))
                            )
                        }

                        // Exact Current Time Needle (solid 2px white line)
                        if (isCurrentHour) {
                            val fraction = (currentMinute / 60f).coerceIn(0f, 1f)
                            Box(
                                modifier = Modifier
                                    .fillMaxHeight()
                                    .height(32.dp)
                                    .fillMaxWidth(fraction)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .width(2.dp)
                                        .height(32.dp)
                                        .align(Alignment.CenterEnd)
                                        .background(Color.White)
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Tick marks and numbers every 2 hours: 00, 02..24
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                val markers = listOf(0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24)
                markers.forEach { h ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .width(1.dp)
                                .height(5.dp)
                                .background(Color(0xFF707070))
                        )
                        Text(
                            text = String.format("%02d", h),
                            fontSize = 9.sp,
                            fontFamily = FontFamily.Monospace,
                            color = Color(0xFFCCCCCC),
                            modifier = Modifier.padding(top = 1.dp)
                        )
                    }
                }
            }
        }
    }
}
