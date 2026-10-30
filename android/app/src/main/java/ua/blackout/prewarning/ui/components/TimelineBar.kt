package ua.blackout.prewarning.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
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

import java.time.LocalDate
import ua.blackout.prewarning.data.parser.ZtoeParser

@Composable
fun TimelineBar(
    slots: List<BlackoutSlot> = remember { ZtoeParser.generateFallbackSchedule("2.1", LocalDate.now().toString()) },
    currentHour: Int = 12,
    modifier: Modifier = Modifier,
    onHourClick: (BlackoutSlot) -> Unit = {}
) {
    Column(modifier = modifier) {
        // Chart row with 24 hours. Blocks within the same hour are closer to each other, with larger spacing between hours.
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(84.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF0A0E17))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(5.dp), // Spacing between different hours
            verticalAlignment = Alignment.Bottom
        ) {
            slots.forEach { slot ->
                val isOff = slot.status == SlotStatus.POWER_OFF
                val isCurrent = slot.startHour == currentHour

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clickable { onHourClick(slot) },
                    verticalArrangement = Arrangement.Bottom,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Two sub-blocks representing this one hour, placed tightly together (gap = 1.dp)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f, fill = false),
                        horizontalArrangement = Arrangement.spacedBy(1.dp), // Tight spacing for blocks representing one hour
                        verticalAlignment = Alignment.Bottom
                    ) {
                        // Sub-block 1 (first 30 min of the hour)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(if (isOff) 52.dp else 18.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(if (isOff) Color(0xFFFF5E3A) else Color.White.copy(alpha = 0.2f))
                        )
                        // Sub-block 2 (second 30 min of the hour)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(if (isOff) 52.dp else 18.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(if (isOff) Color(0xFFFF5E3A) else Color.White.copy(alpha = 0.2f))
                        )
                    }

                    // Hour indicator below pillar (every 3 hours)
                    if (slot.startHour % 3 == 0) {
                        Text(
                            text = String.format("%02d", slot.startHour),
                            fontSize = 8.sp,
                            fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                            fontFamily = FontFamily.Monospace,
                            color = if (isCurrent) Color.White else Color.White.copy(alpha = 0.5f),
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    } else {
                        Spacer(modifier = Modifier.height(10.dp))
                    }
                }
            }
        }
    }
}
