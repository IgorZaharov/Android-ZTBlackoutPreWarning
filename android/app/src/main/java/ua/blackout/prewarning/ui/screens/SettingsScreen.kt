package ua.blackout.prewarning.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AlarmOff
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Vibration
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import ua.blackout.prewarning.data.parser.AddressLookupResult
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.parser.ZtoeHouseLookupResult
import ua.blackout.prewarning.data.parser.ZtoeRemOption
import ua.blackout.prewarning.data.parser.ZtoeSettlementOption
import ua.blackout.prewarning.data.parser.ZtoeStreetOption
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.GlassCard
import ua.blackout.prewarning.ui.components.PickerItem
import ua.blackout.prewarning.ui.components.PickerSearch
import ua.blackout.prewarning.ui.components.SearchablePickerField
import ua.blackout.prewarning.ui.components.glassFieldColors
import ua.blackout.prewarning.ui.theme.ZtColors
import ua.blackout.prewarning.ui.theme.ZtMinTouch
import ua.blackout.prewarning.ui.theme.ZtShapes
import ua.blackout.prewarning.ui.theme.ZtType

/** Presets for "warn me N minutes before". 5 and 10 work: alarms are exact, only the site refresh is bounded by WorkManager. */
private val ADVANCE_PRESETS = listOf(5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240)

/** Presets for the site check. WorkManager never runs periodic work more often than every 15 minutes. */
private val REFRESH_PRESETS = listOf(15, 30, 60, 120, 180, 240)

private val QUEUES = listOf(
    "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
    "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
)

private const val ZTOE_SEARCH_URL = "https://www.ztoe.com.ua/unhooking-search.php"

/**
 * Settings page.
 *
 * @param exactAlarmMissing show the card that explains the "Alarms & reminders" permission
 * @param onOpenExactAlarmSettings opens that system screen
 * @param isVisible false while the pager keeps this page composed off screen; the site check waits
 *   until the page is shown so launch does not run a second full schedule fetch
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    currentQueue: String = "",
    customQueueStatusText: String? = null,
    selectedAddressQuery: SelectedAddressQuery? = null,
    siteUrl: String = ZTOE_SEARCH_URL,
    // CRITICAL CONSTANTS — Default values: advanceMinutes = 15, refreshMinutes = 30. Never modify on your own.
    advanceMinutes: Int = 15,
    refreshMinutes: Int = 30,
    notificationsEnabled: Boolean = true,
    emergencyNotificationsEnabled: Boolean = true,
    soundEnabled: Boolean = true,
    vibrationEnabled: Boolean = true,
    currentLanguage: String = "SYSTEM",
    lang: String = "uk",
    autoOpenQueueHelp: Boolean = false,
    onAutoOpenQueueHelpHandled: () -> Unit = {},
    onQueueSelected: (String) -> Unit = {},
    onAddressQueueResolved: (
        queue: String,
        statusText: String?,
        addressLabel: String,
        query: SelectedAddressQuery
    ) -> Unit = { _, _, _, _ -> },
    onSiteUrlChanged: (String) -> Unit = {},
    onAdvanceMinutesChanged: (Int) -> Unit = {},
    onRefreshMinutesChanged: (Int) -> Unit = {},
    onToggleNotifications: (Boolean) -> Unit = {},
    onToggleEmergencyNotifications: (Boolean) -> Unit = {},
    onToggleSound: (Boolean) -> Unit = {},
    onToggleVibration: (Boolean) -> Unit = {},
    onLanguageSelected: (String) -> Unit = {},
    onSendTestAlert: () -> Unit = {},
    onForceRefresh: () -> Unit = {},
    onResetDefaults: () -> Unit = {},
    onShowAppBanner: (String) -> Unit = {},
    exactAlarmMissing: Boolean = false,
    onOpenExactAlarmSettings: () -> Unit = {},
    isVisible: Boolean = true
) {
    val context = LocalContext.current
    var showQueueHelpDialog by remember { mutableStateOf(false) }
    var showResetConfirmDialog by remember { mutableStateOf(false) }

    LaunchedEffect(autoOpenQueueHelp) {
        if (autoOpenQueueHelp) {
            showQueueHelpDialog = true
            onAutoOpenQueueHelpHandled()
        }
    }

    val isUrlInValidList = remember(siteUrl) { ZtoeParser.isValidUrl(siteUrl, context) }
    var urlFetchStatus by remember { mutableStateOf(FetchStatus.SUCCESS) }
    var isVerifyingUrl by remember { mutableStateOf(false) }
    var urlChecked by remember { mutableStateOf(false) }

    // Live URL verification against valid-urls.json + the real table; waits until the page is on screen
    LaunchedEffect(siteUrl, currentQueue, isVisible) {
        if (!isVisible) return@LaunchedEffect
        if (!ZtoeParser.isValidUrl(siteUrl, context)) {
            urlFetchStatus = FetchStatus.NO_QUEUES_FOUND
            urlChecked = true
            return@LaunchedEffect
        }
        isVerifyingUrl = true
        val verifyQueue = currentQueue.ifBlank { "1.1" }
        val res = withContext(Dispatchers.IO) {
            ZtoeParser.fetchFullSchedule(siteUrl, verifyQueue, context)
        }
        urlFetchStatus = res.status
        isVerifyingUrl = false
        urlChecked = true
    }

    val isChecking = isVerifyingUrl || !urlChecked
    val isSiteVerifiedSuccess = isUrlInValidList && urlFetchStatus == FetchStatus.SUCCESS

    val queueFieldDisplay = when {
        !customQueueStatusText.isNullOrBlank() -> AppStrings.noQueueNotDisconnected(lang)
        currentQueue.isBlank() -> AppStrings.selectQueueAction(lang)
        else -> "${AppStrings.queue(lang)} $currentQueue"
    }

    val minShort = AppStrings.minShort(lang)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(Icons.Default.Tune, contentDescription = null, tint = ZtColors.Accent, modifier = Modifier.size(24.dp))
            Text(
                text = AppStrings.settingsTitle(lang),
                style = ZtType.heading,
                color = Color.White,
                modifier = Modifier.weight(1f)
            )
        }

        // Exact-alarm permission (Android 12+): plain instruction and a button to the right system screen
        if (exactAlarmMissing) {
            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                borderColor = Color(0x59FF5E3A),
                contentPadding = PaddingValues18
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.AlarmOff, contentDescription = null, tint = ZtColors.Accent, modifier = Modifier.size(24.dp))
                        Text(
                            text = AppStrings.exactAlarmTitle(lang),
                            style = ZtType.subhead,
                            color = Color.White,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Text(text = AppStrings.exactAlarmBody(lang), style = ZtType.body, color = ZtColors.TextSecondary)
                    ActionButton(
                        text = AppStrings.exactAlarmButton(lang),
                        icon = null,
                        filled = true,
                        onClick = onOpenExactAlarmSettings,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        // 1. Queue selection
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier.weight(1f).padding(end = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Text(text = AppStrings.queueTitle(lang), style = ZtType.overline, color = Color.White)
                        Text(text = AppStrings.queueDesc(lang), style = ZtType.caption, color = ZtColors.TextSecondary)
                    }
                    // 48 dp touch target around the 40 dp "?" tile
                    Box(
                        modifier = Modifier
                            .size(ZtMinTouch)
                            .clickable(role = Role.Button, onClickLabel = AppStrings.queueHelpTitle(lang)) { showQueueHelpDialog = true }
                            .semantics { contentDescription = AppStrings.queueHelpTitle(lang) },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(ZtColors.Accent)
                                .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(16.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.HelpOutline, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                    }
                }

                GlassDropdown(
                    value = queueFieldDisplay,
                    options = QUEUES.map { "${AppStrings.queue(lang)} $it" },
                    onSelect = { onQueueSelected(QUEUES[it]) }
                )
            }
        }

        // 2. Site address with a strict check against valid-urls.json and the live table
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = AppStrings.siteAddressTitle(lang),
                        style = ZtType.overline,
                        color = Color.White,
                        modifier = Modifier.padding(vertical = 6.dp)
                    )
                    when {
                        isChecking -> StatusChip(
                            text = AppStrings.siteStateChecking(lang),
                            background = ZtColors.ChipGrey,
                            foreground = ZtColors.ChipGreyText,
                            icon = null
                        )
                        isSiteVerifiedSuccess -> StatusChip(
                            text = AppStrings.siteReachable(lang),
                            background = ZtColors.ChipGreen,
                            foreground = ZtColors.ChipGreenText,
                            icon = null
                        )
                        else -> StatusChip(
                            text = if (urlFetchStatus == FetchStatus.NO_INTERNET) {
                                AppStrings.errorNoInternet(lang)
                            } else {
                                AppStrings.errorNoQueuesFound(lang)
                            },
                            background = ZtColors.ChipRed,
                            foreground = ZtColors.ChipRedText,
                            icon = Icons.Default.ErrorOutline
                        )
                    }
                }

                Text(text = AppStrings.siteAddressDesc(lang), style = ZtType.caption, color = ZtColors.TextSecondary)

                val urlBad = !isChecking && !isSiteVerifiedSuccess
                OutlinedTextField(
                    value = siteUrl,
                    onValueChange = { onSiteUrlChanged(it) },
                    singleLine = true,
                    textStyle = ZtType.body,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                    shape = ZtShapes.Control,
                    colors = glassFieldColors(
                        focusedBorder = if (urlBad) Color(0xFFEF4444) else ZtColors.Accent,
                        unfocusedBorder = if (urlBad) Color(0x66EF4444) else ZtColors.InputBorder
                    )
                )
            }
        }

        // 3. Timers: presets only (no free text), ranges match what really works
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(text = AppStrings.advanceNoticeTitle(lang), style = ZtType.overline, color = Color.White)
                        Text(
                            text = "${AppStrings.advanceNoticeHint(lang)} · ${AppStrings.rangeMinutes(lang, ADVANCE_PRESETS.first(), ADVANCE_PRESETS.last())}",
                            style = ZtType.caption,
                            color = ZtColors.TextTertiary
                        )
                    }
                    GlassDropdown(
                        value = "$advanceMinutes $minShort",
                        options = ADVANCE_PRESETS.map { "$it $minShort" },
                        onSelect = { onAdvanceMinutesChanged(ADVANCE_PRESETS[it]) }
                    )
                }

                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))

                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(text = AppStrings.refreshIntervalTitle(lang), style = ZtType.overline, color = Color.White)
                        Text(
                            text = "${AppStrings.rangeMinutes(lang, REFRESH_PRESETS.first(), REFRESH_PRESETS.last())} · ${AppStrings.refreshFloorHint(lang)}",
                            style = ZtType.caption,
                            color = ZtColors.TextTertiary
                        )
                    }
                    GlassDropdown(
                        value = "$refreshMinutes $minShort",
                        options = REFRESH_PRESETS.map { "$it $minShort" },
                        onSelect = { onRefreshMinutesChanged(REFRESH_PRESETS[it]) }
                    )
                }
            }
        }

        // 4. Planned alerts: master switch, then sound and vibration (shared by planned and emergency alerts)
        val anyAlertsEnabled = notificationsEnabled || emergencyNotificationsEnabled
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SwitchRow(
                    icon = Icons.Default.Notifications,
                    iconTint = Color.White,
                    title = AppStrings.notifications(lang),
                    hint = AppStrings.notificationsHint(lang),
                    checked = notificationsEnabled,
                    onCheckedChange = onToggleNotifications,
                    lang = lang
                )
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))
                SwitchRow(
                    icon = Icons.Default.VolumeUp,
                    iconTint = if (anyAlertsEnabled) Color(0xB3BAE6FD) else Color(0x4DBAE6FD),
                    title = AppStrings.sound(lang),
                    hint = null,
                    checked = anyAlertsEnabled && soundEnabled,
                    onCheckedChange = onToggleSound,
                    lang = lang,
                    enabled = anyAlertsEnabled
                )
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.Divider))
                SwitchRow(
                    icon = Icons.Default.Vibration,
                    iconTint = if (anyAlertsEnabled) Color(0xB3BAE6FD) else Color(0x4DBAE6FD),
                    title = AppStrings.vibration(lang),
                    hint = null,
                    checked = anyAlertsEnabled && vibrationEnabled,
                    onCheckedChange = onToggleVibration,
                    lang = lang,
                    enabled = anyAlertsEnabled
                )
                Text(
                    text = AppStrings.soundVibrationHint(lang),
                    style = ZtType.caption,
                    color = ZtColors.TextTertiary,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }

        // 4b. Emergency Power Outages Switch (own card: independent of the planned alerts above; always visible, ON by default)
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            SwitchRow(
                icon = Icons.Default.Warning,
                iconTint = ZtColors.Accent,
                title = AppStrings.emergencyNotifications(lang),
                hint = AppStrings.emergencyHint(lang),
                checked = emergencyNotificationsEnabled,
                onCheckedChange = onToggleEmergencyNotifications,
                lang = lang
            )
        }

        // 5. Language
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Language, contentDescription = null, tint = ZtColors.Accent, modifier = Modifier.size(18.dp))
                    Text(
                        text = AppStrings.languageTitle(lang),
                        style = ZtType.overline,
                        color = Color.White,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .selectableGroup()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x59000000))
                        .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf(
                        "SYSTEM" to AppStrings.langSystem(lang),
                        "uk" to "Українська",
                        "en" to "English"
                    ).forEach { (code, label) ->
                        val isSelected = currentLanguage.equals(code, ignoreCase = true)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = ZtMinTouch - 8.dp)
                                .clip(RoundedCornerShape(9.dp))
                                .background(if (isSelected) Color.White else Color.Transparent)
                                .selectable(selected = isSelected, role = Role.RadioButton) { onLanguageSelected(code) }
                                .padding(vertical = 8.dp, horizontal = 6.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                style = ZtType.label,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                                color = if (isSelected) Color.Black else Color(0xBFE0F2FE),
                                textAlign = TextAlign.Center,
                                maxLines = 2
                            )
                        }
                    }
                }
            }
        }

        // 6. Diagnostics and actions
        GlassCard(modifier = Modifier.fillMaxWidth(), contentPadding = PaddingValues18) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val stackButtons = LocalDensity.current.fontScale >= 1.3f
                val testButton: @Composable (Modifier) -> Unit = { m ->
                    ActionButton(
                        text = AppStrings.testAlertBtn(lang),
                        icon = Icons.Default.Send,
                        filled = true,
                        onClick = {
                            onSendTestAlert()
                            onShowAppBanner(AppStrings.testAlertSent(lang))
                        },
                        modifier = m
                    )
                }
                val refreshButton: @Composable (Modifier) -> Unit = { m ->
                    ActionButton(
                        text = AppStrings.refreshBtn(lang),
                        icon = Icons.Default.Language,
                        filled = false,
                        onClick = onForceRefresh,
                        modifier = m
                    )
                }
                if (stackButtons) {
                    testButton(Modifier.fillMaxWidth())
                    refreshButton(Modifier.fillMaxWidth())
                } else {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        testButton(Modifier.weight(1f))
                        refreshButton(Modifier.weight(1f))
                    }
                }

                ActionButton(
                    text = AppStrings.resetDefaultsBtn(lang),
                    icon = Icons.Default.Refresh,
                    filled = false,
                    subdued = true,
                    onClick = { showResetConfirmDialog = true },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        Spacer(modifier = Modifier.height(96.dp))
    }

    if (showQueueHelpDialog) {
        AddressLookupDialog(
            siteUrl = siteUrl,
            lang = lang,
            saved = selectedAddressQuery,
            onDismiss = { showQueueHelpDialog = false },
            onApply = { queue, statusText, addressLabel, query ->
                onAddressQueueResolved(queue, statusText, addressLabel, query)
                showQueueHelpDialog = false
            },
            onShowAppBanner = onShowAppBanner
        )
    }

    if (showResetConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showResetConfirmDialog = false },
            title = { Text(AppStrings.resetConfirmTitle(lang), style = ZtType.heading, color = Color.White) },
            text = { Text(AppStrings.resetConfirmDesc(lang), style = ZtType.body, color = ZtColors.TextSecondary) },
            confirmButton = {
                TextButton(
                    onClick = {
                        onResetDefaults()
                        showResetConfirmDialog = false
                        onShowAppBanner(AppStrings.settingsReset(lang))
                    },
                    modifier = Modifier.heightIn(min = ZtMinTouch)
                ) {
                    Text(AppStrings.resetYes(lang), style = ZtType.label, color = ZtColors.Accent, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showResetConfirmDialog = false }, modifier = Modifier.heightIn(min = ZtMinTouch)) {
                    Text(AppStrings.cancel(lang), style = ZtType.label, color = Color.White)
                }
            },
            containerColor = ZtColors.CardSolid
        )
    }
}

private val PaddingValues18 = PaddingValues(18.dp)

// =============================================================================================
// Small building blocks
// =============================================================================================

@Composable
private fun StatusChip(text: String, background: Color, foreground: Color, icon: ImageVector?) {
    Row(
        modifier = Modifier
            .clip(ZtShapes.Chip)
            .background(background)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = foreground, modifier = Modifier.size(16.dp))
        Text(text = text, style = ZtType.label, color = foreground)
    }
}

@Composable
private fun switchColors(): androidx.compose.material3.SwitchColors = SwitchDefaults.colors(
    checkedThumbColor = Color.White,
    checkedTrackColor = ZtColors.Accent,
    uncheckedThumbColor = Color.LightGray,
    uncheckedTrackColor = Color(0x33FFFFFF),
    disabledCheckedTrackColor = Color(0x33FF5E3A),
    disabledUncheckedTrackColor = Color(0x1AFFFFFF),
    disabledUncheckedThumbColor = Color(0x4DFFFFFF)
)

/**
 * A labelled switch row. The whole row is the toggle target (role Switch, localized On/Off state), so
 * TalkBack reads "title, hint, On" once; the [Switch] itself is only drawn.
 */
@Composable
private fun SwitchRow(
    icon: ImageVector,
    iconTint: Color,
    title: String,
    hint: String?,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    lang: String,
    enabled: Boolean = true
) {
    val stateText = if (checked) AppStrings.switchOn(lang) else AppStrings.switchOff(lang)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = ZtMinTouch)
            .toggleable(value = checked, enabled = enabled, role = Role.Switch, onValueChange = onCheckedChange)
            .semantics { stateDescription = stateText },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(20.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = title,
                style = ZtType.subhead,
                color = if (enabled) Color.White else Color(0x80FFFFFF)
            )
            if (hint != null) {
                Text(
                    text = hint,
                    style = ZtType.caption,
                    color = if (enabled) ZtColors.TextSecondary else ZtColors.TextTertiary
                )
            }
        }
        Switch(checked = checked, onCheckedChange = null, enabled = enabled, colors = switchColors())
    }
}

/** Read-only dropdown for short preset lists (queues, minutes). Long searchable lists use SearchablePickerField. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GlassDropdown(value: String, options: List<String>, onSelect: (Int) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            singleLine = true,
            textStyle = ZtType.body,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth().heightIn(min = 56.dp),
            shape = ZtShapes.Control,
            colors = glassFieldColors()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(ZtColors.CardSolid)
        ) {
            options.forEachIndexed { index, text ->
                DropdownMenuItem(
                    text = { Text(text, style = ZtType.subhead, color = Color.White) },
                    onClick = {
                        onSelect(index)
                        expanded = false
                    }
                )
            }
        }
    }
}

/** Button with a 48 dp minimum height. [filled] is the accent button, [subdued] the quiet outlined one. */
@Composable
private fun ActionButton(
    text: String,
    icon: ImageVector?,
    filled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subdued: Boolean = false
) {
    val shape = ZtShapes.Control
    val contentColor = if (subdued) ZtColors.TextSecondary else Color.White
    Box(
        modifier = modifier
            .heightIn(min = ZtMinTouch)
            .clip(shape)
            .then(
                when {
                    filled -> Modifier.background(ZtColors.Accent)
                    subdued -> Modifier.border(1.dp, Color(0x1AFFFFFF), shape)
                    else -> Modifier.background(Color(0x1AFFFFFF)).border(1.dp, ZtColors.CardBorder, shape)
                }
            )
            .clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)
        ) {
            if (icon != null) Icon(icon, contentDescription = null, tint = contentColor, modifier = Modifier.size(16.dp))
            Text(
                text = text,
                style = ZtType.label,
                fontWeight = if (filled) FontWeight.Bold else FontWeight.SemiBold,
                color = contentColor,
                textAlign = TextAlign.Center
            )
        }
    }
}

private fun ZtoeRemOption.displayName(lang: String) = if (lang == "uk") nameUk else nameEn
private fun ZtoeSettlementOption.displayName(lang: String) = if (lang == "uk") nameUk else nameEn
private fun ZtoeStreetOption.displayName(lang: String) = if (lang == "uk") nameUk else nameEn

/** Loading flags of one level of the REM, city, street, house cascade; [retry] re-runs its fetch with forceRefresh. */
private class LevelState {
    var loading by mutableStateOf(false)
    var failed by mutableStateOf(false)
    var retry by mutableIntStateOf(0)
}

// =============================================================================================
// Full-screen queue help and address lookup dialog ("?" button)
// =============================================================================================

@Composable
private fun AddressLookupDialog(
    siteUrl: String,
    lang: String,
    saved: SelectedAddressQuery?,
    onDismiss: () -> Unit,
    onApply: (queue: String, statusText: String?, addressLabel: String, query: SelectedAddressQuery) -> Unit,
    onShowAppBanner: (String) -> Unit
) {
    // The cascade starts from the saved address, or from Zhytomyr city on a first launch. After that a REM
    // never picks a city for the user: choosing another REM clears city, street and house.
    var selectedRemId by remember { mutableStateOf(saved?.remId?.ifBlank { "zhytomyr" } ?: "zhytomyr") }
    var selectedSettlementId by remember { mutableStateOf(saved?.settlementId?.ifBlank { "zt_city" } ?: "zt_city") }
    var selectedStreetId by remember { mutableStateOf(saved?.streetId ?: "") }
    var selectedHouse by remember { mutableStateOf(saved?.house ?: "") }

    var allRems by remember { mutableStateOf(ZtoeAddressLookup.getRems()) }
    var settlementsList by remember { mutableStateOf(ZtoeAddressLookup.getSettlementsForRem(selectedRemId)) }
    var streetsList by remember {
        mutableStateOf(
            if (selectedSettlementId.isNotBlank()) ZtoeAddressLookup.getStreetsForSettlement(selectedSettlementId) else emptyList()
        )
    }
    var housesList by remember {
        mutableStateOf(
            if (selectedStreetId.isNotBlank()) ZtoeAddressLookup.getHousesForStreet(selectedStreetId) else emptyList()
        )
    }
    val remsState = remember { LevelState() }
    val settlementsState = remember { LevelState() }
    val streetsState = remember { LevelState() }
    val housesState = remember { LevelState() }

    var isCheckingAddressOnSite by remember { mutableStateOf(false) }
    var addressCheckFailed by remember { mutableStateOf(false) }
    var addressLookupResult by remember { mutableStateOf<AddressLookupResult?>(null) }

    fun clearBelowRem() {
        selectedSettlementId = ""
        selectedStreetId = ""
        selectedHouse = ""
        streetsList = emptyList()
        housesList = emptyList()
        addressLookupResult = null
    }

    fun clearBelowSettlement() {
        selectedStreetId = ""
        selectedHouse = ""
        housesList = emptyList()
        addressLookupResult = null
    }

    // REM list. A retry forces a fresh fetch; otherwise the in-memory cache is used.
    LaunchedEffect(siteUrl, remsState.retry) {
        remsState.loading = true
        remsState.failed = false
        val fetched = withContext(Dispatchers.IO) {
            runCatching { ZtoeAddressLookup.fetchRemsFromZtoe(siteUrl, forceRefresh = remsState.retry > 0) }.getOrNull()
        }
        if (!fetched.isNullOrEmpty()) allRems = fetched
        remsState.failed = allRems.isEmpty()
        remsState.loading = false
    }

    // City list of the chosen REM. Never selects a city by itself; only drops a choice that no longer exists.
    LaunchedEffect(selectedRemId, siteUrl, settlementsState.retry) {
        settlementsList = ZtoeAddressLookup.getSettlementsForRem(selectedRemId)
        settlementsState.loading = true
        settlementsState.failed = false
        val fetched = withContext(Dispatchers.IO) {
            runCatching {
                ZtoeAddressLookup.fetchSettlementsForRem(selectedRemId, siteUrl, forceRefresh = settlementsState.retry > 0)
            }.getOrDefault(emptyList())
        }
        if (fetched.isNotEmpty()) settlementsList = fetched
        settlementsState.failed = settlementsList.isEmpty()
        settlementsState.loading = false
        if (selectedSettlementId.isNotBlank() && settlementsList.isNotEmpty() && settlementsList.none { it.id == selectedSettlementId }) {
            selectedSettlementId = ""
            clearBelowSettlement()
        }
    }

    // Street list (the fetch also bulk-indexes the houses of the whole settlement)
    LaunchedEffect(selectedRemId, selectedSettlementId, siteUrl, streetsState.retry) {
        if (selectedSettlementId.isBlank()) {
            streetsList = emptyList()
            streetsState.loading = false
            streetsState.failed = false
            return@LaunchedEffect
        }
        streetsList = ZtoeAddressLookup.getStreetsForSettlement(selectedSettlementId)
        streetsState.loading = true
        streetsState.failed = false
        val fetched = withContext(Dispatchers.IO) {
            runCatching {
                ZtoeAddressLookup.fetchStreetsForSettlement(
                    selectedRemId, selectedSettlementId, siteUrl, forceRefresh = streetsState.retry > 0
                )
            }.getOrDefault(emptyList())
        }
        if (fetched.isNotEmpty()) {
            streetsList = fetched
            allRems = ZtoeAddressLookup.getRems()
            settlementsList = ZtoeAddressLookup.getSettlementsForRem(selectedRemId)
            if (selectedStreetId.isNotBlank()) {
                val bulkIndexed = ZtoeAddressLookup.getHousesForStreet(selectedStreetId)
                if (bulkIndexed.isNotEmpty()) housesList = bulkIndexed
            }
        }
        streetsState.failed = streetsList.isEmpty()
        streetsState.loading = false
    }

    // House list of the chosen street (served from the bulk index when it is already there)
    LaunchedEffect(selectedRemId, selectedSettlementId, selectedStreetId, siteUrl, housesState.retry) {
        if (selectedStreetId.isBlank()) {
            housesList = emptyList()
            housesState.loading = false
            housesState.failed = false
            return@LaunchedEffect
        }
        housesList = ZtoeAddressLookup.getHousesForStreet(selectedStreetId)
        housesState.loading = true
        housesState.failed = false
        val fetched = withContext(Dispatchers.IO) {
            runCatching {
                ZtoeAddressLookup.fetchHousesForStreet(
                    selectedRemId, selectedSettlementId, selectedStreetId, siteUrl, forceRefresh = housesState.retry > 0
                )
            }.getOrDefault(emptyList())
        }
        if (fetched.isNotEmpty()) housesList = fetched
        housesState.failed = housesList.isEmpty()
        housesState.loading = false
    }

    val currentRem = allRems.firstOrNull { it.id == selectedRemId }
    val currentSettlement = if (selectedSettlementId.isBlank()) null else {
        settlementsList.find { it.id == selectedSettlementId } ?: ZtoeAddressLookup.findSettlementById(selectedSettlementId)
    }
    val currentStreet = if (selectedStreetId.isBlank()) null else {
        streetsList.find { it.id == selectedStreetId } ?: ZtoeAddressLookup.findStreetById(selectedStreetId)
    }
    val currentHouseRecord = housesList.find { it.house.equals(selectedHouse, ignoreCase = true) }

    // Queries the site when street and house are chosen. Nothing closes or applies until the user presses the button.
    LaunchedEffect(selectedRemId, selectedSettlementId, selectedStreetId, selectedHouse, siteUrl) {
        addressLookupResult = null
        addressCheckFailed = false
        if (selectedStreetId.isBlank() || selectedHouse.isBlank()) {
            isCheckingAddressOnSite = false
            return@LaunchedEffect
        }
        isCheckingAddressOnSite = true
        val res = withContext(Dispatchers.IO) {
            runCatching {
                ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                    remId = selectedRemId,
                    settlementId = selectedSettlementId,
                    streetId = selectedStreetId,
                    house = selectedHouse,
                    siteUrl = siteUrl
                )
            }.getOrNull()
        }
        isCheckingAddressOnSite = false
        addressLookupResult = res
        addressCheckFailed = res == null
        if (res != null) {
            val exists = housesList.any { it.house.equals(res.house, ignoreCase = true) }
            housesList = if (!exists) {
                housesList + res
            } else {
                housesList.map { h ->
                    if (h.house.equals(res.house, ignoreCase = true)) {
                        h.copy(
                            queue = res.queue.ifEmpty { h.queue },
                            statusText = res.statusText ?: h.statusText,
                            addressLabel = res.addressLabel.ifEmpty { h.addressLabel }
                        )
                    } else h
                }
            }
        }
    }

    val selectedAddressStr = if (currentStreet != null && selectedHouse.isNotBlank()) {
        val remName = currentRem?.displayName(lang).orEmpty()
        val settlementName = currentSettlement?.displayName(lang).orEmpty()
        val streetName = currentStreet.displayName(lang)
        "$remName, $settlementName,\n$streetName, ${AppStrings.addrHousePrefix(lang)} $selectedHouse"
    } else {
        ""
    }

    val remItems = remember(allRems, lang) { allRems.map { PickerItem(it.id, it.displayName(lang)) } }
    val settlementItems = remember(settlementsList, lang) { settlementsList.map { PickerItem(it.id, it.displayName(lang)) } }
    val streetItems = remember(streetsList, lang) { streetsList.map { PickerItem(it.id, it.displayName(lang)) } }
    val houseItems = remember(housesList) { housesList.map { PickerItem(it.house, it.house) } }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(ZtColors.CardSolid)
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 14.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Modal header
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(ZtColors.Accent),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = "?", style = ZtType.heading, fontWeight = FontWeight.Black, color = Color.White, maxLines = 1)
                            }
                            Text(
                                text = AppStrings.queueHelpTitle(lang),
                                style = ZtType.heading,
                                color = Color.White,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Box(
                            modifier = Modifier
                                .size(ZtMinTouch)
                                .clickable(role = Role.Button, onClickLabel = AppStrings.pickerClose(lang), onClick = onDismiss)
                                .semantics { contentDescription = AppStrings.pickerClose(lang) },
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(Color(0x1AFFFFFF))
                                    .border(1.dp, ZtColors.CardBorder, CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Close, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                            }
                        }
                    }
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(ZtColors.InputBorder))
                }

                // 1) Interactive search by address
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(Color(0x0DFFFFFF))
                        .border(2.dp, Color.White.copy(alpha = 0.25f), RoundedCornerShape(24.dp))
                        .padding(20.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = AppStrings.addrFindTitle(lang).uppercase(),
                                style = ZtType.label,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 0.7.sp,
                                color = Color.White
                            )
                            Text(
                                text = AppStrings.queueHelpAddressSubtitle(lang),
                                style = ZtType.caption,
                                color = Color(0xCCBAE6FD)
                            )
                        }

                        SearchablePickerField(
                            label = AppStrings.addrRemLabel(lang),
                            value = currentRem?.displayName(lang),
                            placeholder = AppStrings.addrRemPlaceholder(lang),
                            items = remItems,
                            selectedId = selectedRemId,
                            onSelect = { item ->
                                if (item.id != selectedRemId) {
                                    selectedRemId = item.id
                                    clearBelowRem()
                                }
                            },
                            lang = lang,
                            loading = remsState.loading,
                            loadFailed = remsState.failed,
                            onRetry = { remsState.retry++ }
                        )

                        SearchablePickerField(
                            label = AppStrings.addrCityLabel(lang),
                            value = currentSettlement?.displayName(lang),
                            placeholder = AppStrings.addrCityPlaceholder(lang),
                            items = settlementItems,
                            selectedId = selectedSettlementId.ifBlank { null },
                            onSelect = { item ->
                                if (item.id != selectedSettlementId) {
                                    selectedSettlementId = item.id
                                    clearBelowSettlement()
                                }
                            },
                            lang = lang,
                            loading = settlementsState.loading,
                            loadFailed = settlementsState.failed,
                            onRetry = { settlementsState.retry++ }
                        )

                        SearchablePickerField(
                            label = AppStrings.addrStreetLabel(lang),
                            value = currentStreet?.displayName(lang),
                            placeholder = AppStrings.addrStreetPlaceholder(lang),
                            items = streetItems,
                            selectedId = selectedStreetId.ifBlank { null },
                            onSelect = { item ->
                                if (item.id != selectedStreetId) {
                                    selectedStreetId = item.id
                                    selectedHouse = ""
                                    housesList = ZtoeAddressLookup.getHousesForStreet(item.id)
                                    addressLookupResult = null
                                }
                            },
                            lang = lang,
                            enabled = selectedSettlementId.isNotBlank(),
                            disabledHint = AppStrings.pickerChooseFirst(lang),
                            loading = streetsState.loading,
                            loadFailed = streetsState.failed && selectedSettlementId.isNotBlank(),
                            onRetry = { streetsState.retry++ }
                        )

                        SearchablePickerField(
                            label = AppStrings.addrHouseLabel(lang),
                            value = selectedHouse,
                            placeholder = AppStrings.addrHousePlaceholder(lang),
                            items = houseItems,
                            selectedId = selectedHouse.ifBlank { null },
                            onSelect = { item ->
                                selectedHouse = item.id
                                addressLookupResult = null
                            },
                            lang = lang,
                            enabled = currentStreet != null,
                            disabledHint = AppStrings.pickerChooseFirst(lang),
                            loading = housesState.loading,
                            loadFailed = housesState.failed && currentStreet != null,
                            onRetry = { housesState.retry++ },
                            kind = PickerSearch.Kind.HOUSE
                        )

                        // Result card (shown when a house is selected)
                        val validLookupResult = addressLookupResult?.takeIf {
                            it.house.equals(selectedHouse, ignoreCase = true)
                        }
                        val matchedRecord: ZtoeHouseLookupResult? = when {
                            validLookupResult != null && currentHouseRecord != null -> validLookupResult.copy(
                                queue = validLookupResult.queue.ifEmpty { currentHouseRecord.queue },
                                statusText = validLookupResult.statusText ?: currentHouseRecord.statusText
                            )
                            validLookupResult != null -> validLookupResult
                            currentHouseRecord != null -> currentHouseRecord
                            selectedHouse.isNotBlank() -> AddressLookupResult(
                                house = selectedHouse,
                                queue = "",
                                addressLabel = selectedAddressStr
                            )
                            else -> null
                        }
                        if (selectedHouse.isNotBlank() && matchedRecord != null) {
                            // while the site answers, an address without a known queue cannot be confirmed yet
                            val canApply = !(isCheckingAddressOnSite && matchedRecord.queue.isBlank())
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 6.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(Color(0xD9141A29))
                                    .border(2.dp, Color.White.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                                    .padding(16.dp)
                            ) {
                                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    if (selectedAddressStr.isNotBlank()) {
                                        Text(
                                            text = selectedAddressStr,
                                            style = ZtType.label,
                                            color = Color(0xE6BAE6FD)
                                        )
                                    }

                                    if (isCheckingAddressOnSite) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            CircularProgressIndicator(
                                                modifier = Modifier.size(20.dp),
                                                strokeWidth = 2.dp,
                                                color = ZtColors.Accent
                                            )
                                            Text(
                                                text = AppStrings.addrChecking(lang),
                                                style = ZtType.caption,
                                                color = ZtColors.TextSecondary,
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    } else if (addressCheckFailed) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Icon(
                                                Icons.Default.ErrorOutline,
                                                contentDescription = null,
                                                tint = ZtColors.ChipAmberText,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Text(
                                                text = AppStrings.addrCheckFailed(lang),
                                                style = ZtType.caption,
                                                color = ZtColors.ChipAmberText,
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    }

                                    if (matchedRecord.queue.isNotBlank()) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = if (lang == "uk") "Знайдена черга:" else "Found Queue:",
                                                style = ZtType.label,
                                                color = Color(0xCCBAE6FD),
                                                modifier = Modifier.weight(1f)
                                            )
                                            Text(
                                                text = "${AppStrings.queue(lang)} ${matchedRecord.queue}",
                                                style = ZtType.timeMono,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color.White,
                                                softWrap = false
                                            )
                                        }
                                    }

                                    if (!matchedRecord.statusText.isNullOrBlank()) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(16.dp))
                                                .background(Color(0x0FFFFFFF))
                                                .border(2.dp, Color(0x33FFFFFF), RoundedCornerShape(16.dp))
                                                .padding(horizontal = 16.dp, vertical = 12.dp)
                                        ) {
                                            Text(
                                                text = matchedRecord.statusText,
                                                style = ZtType.label,
                                                fontWeight = FontWeight.Bold,
                                                color = Color.White
                                            )
                                        }
                                    }

                                    // Full-width "Обрати чергу X.Y" / "Apply Queue X.Y" button under the address
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .heightIn(min = ZtMinTouch)
                                            .clip(RoundedCornerShape(16.dp))
                                            .background(if (canApply) ZtColors.Accent else Color(0x66FF5E3A))
                                            .clickable(enabled = canApply, role = Role.Button) {
                                                val query = SelectedAddressQuery(
                                                    remId = selectedRemId,
                                                    settlementId = selectedSettlementId,
                                                    streetId = selectedStreetId,
                                                    house = selectedHouse
                                                )
                                                val addressToSave = selectedAddressStr.ifBlank { matchedRecord.addressLabel }
                                                if (matchedRecord.queue.isNotBlank()) {
                                                    onApply(matchedRecord.queue, null, addressToSave, query)
                                                    onShowAppBanner("${AppStrings.queue(lang)} ${matchedRecord.queue}")
                                                } else {
                                                    onApply("", matchedRecord.statusText, addressToSave, query)
                                                    onShowAppBanner(matchedRecord.statusText ?: AppStrings.addrSaved(lang))
                                                }
                                            }
                                            .padding(vertical = 12.dp, horizontal = 16.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = if (matchedRecord.queue.isNotBlank()) {
                                                if (lang == "uk") "Обрати чергу ${matchedRecord.queue}" else "Apply Queue ${matchedRecord.queue}"
                                            } else {
                                                AppStrings.addrConfirm(lang)
                                            },
                                            style = ZtType.subhead,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color.White,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // 2) "Пошук вручну" / "Manual search"
                Text(
                    text = AppStrings.queueHelpManualSearchTitle(lang).uppercase(),
                    style = ZtType.label,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.7.sp,
                    color = Color.White,
                    modifier = Modifier.padding(top = 4.dp, start = 4.dp)
                )

                // 3) Numbered instructions 1-4 (text comes unchanged from AppStrings.queueHelpSteps)
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    AppStrings.queueHelpSteps(lang).forEachIndexed { idx, step ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0x0AFFFFFF))
                                .border(2.dp, Color(0x26FFFFFF), RoundedCornerShape(16.dp))
                                .padding(16.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.Top,
                                horizontalArrangement = Arrangement.spacedBy(14.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .padding(top = 2.dp)
                                        .defaultMinSize(minWidth = 24.dp, minHeight = 24.dp)
                                        .clip(CircleShape)
                                        .background(Color(0x26FFFFFF)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "${idx + 1}",
                                        style = ZtType.captionMono,
                                        color = Color.White,
                                        modifier = Modifier.padding(horizontal = 6.dp)
                                    )
                                }
                                val urlStart = step.indexOf(ZTOE_SEARCH_URL)
                                // only the address itself is a link, not the whole step
                                val annotatedStep = buildAnnotatedString {
                                    if (urlStart >= 0) {
                                        append(step.substring(0, urlStart))
                                        withLink(
                                            LinkAnnotation.Url(
                                                ZTOE_SEARCH_URL,
                                                TextLinkStyles(
                                                    SpanStyle(
                                                        color = ZtColors.Accent,
                                                        fontWeight = FontWeight.SemiBold,
                                                        textDecoration = TextDecoration.Underline
                                                    )
                                                )
                                            )
                                        ) {
                                            append(ZTOE_SEARCH_URL)
                                        }
                                        append(step.substring(urlStart + ZTOE_SEARCH_URL.length))
                                    } else {
                                        append(step)
                                    }
                                }
                                Text(
                                    text = annotatedStep,
                                    style = ZtType.body,
                                    color = Color(0xFFF4F4F5),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }

                // Bottom "Зрозуміло" / "Got it" button (white bg, black text)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp)
                        .heightIn(min = ZtMinTouch)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.White)
                        .clickable(role = Role.Button, onClick = onDismiss)
                        .padding(vertical = 12.dp, horizontal = 20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = AppStrings.queueHelpGotIt(lang),
                        color = Color.Black,
                        style = ZtType.subhead,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
            }
        }
    }
}
