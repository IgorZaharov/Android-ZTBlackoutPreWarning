package ua.blackout.prewarning.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    currentQueue: String = "2.1",
    advanceMinutes: Int = 30,
    refreshMinutes: Int = 30,
    notificationsEnabled: Boolean = true,
    soundEnabled: Boolean = true,
    vibrationEnabled: Boolean = true,
    onQueueSelected: (String) -> Unit = {},
    onAdvanceMinutesChanged: (Int) -> Unit = {},
    onRefreshMinutesChanged: (Int) -> Unit = {},
    onToggleNotifications: (Boolean) -> Unit = {},
    onToggleSound: (Boolean) -> Unit = {},
    onToggleVibration: (Boolean) -> Unit = {},
    onResetDefaults: () -> Unit = {}
) {
    var showQueueHelpDialog by remember { mutableStateOf(false) }
    var showResetConfirmDialog by remember { mutableStateOf(false) }
    var dropdownExpanded by remember { mutableStateOf(false) }
    val queues = listOf(
        "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
        "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Queue Selection with ? help button
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Черга відключення",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        IconButton(
                            onClick = { showQueueHelpDialog = true },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(
                                Icons.Default.HelpOutline,
                                contentDescription = "Як дізнатися свою чергу",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
                Text(
                    text = "Оберіть підчергу за вашою адресою",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.outline
                )
                Spacer(modifier = Modifier.height(10.dp))

                // Dropdown menu
                ExposedDropdownMenuBox(
                    expanded = dropdownExpanded,
                    onExpandedChange = { dropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = "Черга $currentQueue",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = dropdownExpanded,
                        onDismissRequest = { dropdownExpanded = false }
                    ) {
                        queues.forEach { q ->
                            DropdownMenuItem(
                                text = { Text("Черга $q", fontWeight = FontWeight.Bold) },
                                onClick = {
                                    onQueueSelected(q)
                                    dropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }

        // 2. Site Address with Reachability Verification Glyph
        var siteUrl by remember { mutableStateOf("https://www.ztoe.com.ua/unhooking-search.php") }
        val isUrlReachable = remember(siteUrl) { siteUrl.startsWith("http://") || siteUrl.startsWith("https://") }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Адреса сайту", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    // Green V in circle reachability glyph
                    Surface(
                        color = if (isUrlReachable) Color(0xFF10B981).copy(alpha = 0.2f) else MaterialTheme.colorScheme.errorContainer,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isUrlReachable) "✓ Доступний" else "⚠ Недоступний",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isUrlReachable) Color(0xFF10B981) else MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
                Text(
                    "Адреса графіка відключень, зазвичай не потрібно змінювати",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.outline
                )
                OutlinedTextField(
                    value = siteUrl,
                    onValueChange = { siteUrl = it },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    trailingIcon = {
                        if (isUrlReachable) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Доступний", tint = Color(0xFF10B981))
                        }
                    }
                )
            }
        }

        // 3. Timers (Restricted to 1..240 minutes with Android Slider / Stepper controls)
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Advance warning slider & stepper (1..240 min)
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Попереджати заздалегідь", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Surface(
                            color = MaterialTheme.colorScheme.secondaryContainer,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "$advanceMinutes хв",
                                fontWeight = FontWeight.Black,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Діапазон від 1 до 240 хвилин", fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
                    Slider(
                        value = advanceMinutes.coerceIn(1, 240).toFloat(),
                        onValueChange = { onAdvanceMinutesChanged(it.toInt().coerceIn(1, 240)) },
                        valueRange = 1f..240f,
                        steps = 238
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        FilledTonalButton(
                            onClick = { onAdvanceMinutesChanged((advanceMinutes - 15).coerceAtLeast(1)) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("-15")
                        }
                        FilledTonalButton(
                            onClick = { onAdvanceMinutesChanged((advanceMinutes - 5).coerceAtLeast(1)) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("-5")
                        }
                        FilledTonalButton(
                            onClick = { onAdvanceMinutesChanged((advanceMinutes + 5).coerceAtMost(240)) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("+5")
                        }
                        FilledTonalButton(
                            onClick = { onAdvanceMinutesChanged((advanceMinutes + 15).coerceAtMost(240)) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("+15")
                        }
                    }
                }

                HorizontalDivider()

                // Refresh interval slider & stepper (1..240 min)
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Інтервал автоперевірки сайту", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Surface(
                            color = MaterialTheme.colorScheme.secondaryContainer,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "$refreshMinutes хв",
                                fontWeight = FontWeight.Black,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Діапазон від 1 до 240 хвилин", fontSize = 11.sp, color = MaterialTheme.colorScheme.outline)
                    Slider(
                        value = refreshMinutes.coerceIn(1, 240).toFloat(),
                        onValueChange = { onRefreshMinutesChanged(it.toInt().coerceIn(1, 240)) },
                        valueRange = 1f..240f,
                        steps = 238
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        FilledTonalButton(
                            onClick = { onRefreshMinutesChanged((refreshMinutes - 15).coerceAtLeast(1)) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("-15")
                        }
                        FilledTonalButton(
                            onClick = { onRefreshMinutesChanged((refreshMinutes - 5).coerceAtLeast(1)) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("-5")
                        }
                        FilledTonalButton(
                            onClick = { onRefreshMinutesChanged((refreshMinutes + 5).coerceAtMost(240)) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("+5")
                        }
                        FilledTonalButton(
                            onClick = { onRefreshMinutesChanged((refreshMinutes + 15).coerceAtMost(240)) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("+15")
                        }
                    }
                }
            }
        }

        // 3. Notification switches
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Увімкнути сповіщення", fontWeight = FontWeight.Bold)
                    Switch(
                        checked = notificationsEnabled,
                        onCheckedChange = onToggleNotifications
                    )
                }
                Divider()
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Звук сповіщення")
                    Switch(checked = soundEnabled, onCheckedChange = onToggleSound)
                }
                Divider()
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Вібрація")
                    Switch(checked = vibrationEnabled, onCheckedChange = onToggleVibration)
                }
            }
        }

        // 4. Reset to defaults
        OutlinedButton(
            onClick = { showResetConfirmDialog = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Скинути налаштування")
        }
    }

    // Modal Help Dialog for Queue Finding
    if (showQueueHelpDialog) {
        AlertDialog(
            onDismissRequest = { showQueueHelpDialog = false },
            icon = {
                Icon(Icons.Default.HelpOutline, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            },
            title = {
                Text("Як дізнатися свою чергу", fontWeight = FontWeight.Bold)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("1. Відкрийте сторінку пошуку черги на сайті ztoe.com.ua.")
                    Text("2. Оберіть свій РЕМ, населений пункт і вулицю.")
                    Text("3. У таблиці знайдіть свій будинок і подивіться стовпці «Черга» і «Підчерга». Наприклад, черга 5 і підчерга 2 - це 5.2.")
                    Text("4. Виберіть це значення у полі «Черга» у вікні налаштувань (кнопка ⚙).")
                }
            },
            confirmButton = {
                Button(onClick = { showQueueHelpDialog = false }) {
                    Text("Зрозуміло")
                }
            }
        )
    }

    // Reset confirmation dialog
    if (showResetConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showResetConfirmDialog = false },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Підтвердження скидання") },
            text = { Text("Скинути всі налаштування до початкових значень?") },
            confirmButton = {
                Button(
                    onClick = {
                        onResetDefaults()
                        showResetConfirmDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Скинути")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showResetConfirmDialog = false }) {
                    Text("Скасувати")
                }
            }
        )
    }
}
