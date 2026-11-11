package ua.blackout.prewarning.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.data.model.EmergencyOutageInfo
import ua.blackout.prewarning.data.model.SelectedAddressQuery
import ua.blackout.prewarning.data.parser.AddressLookupResult
import ua.blackout.prewarning.data.parser.FetchStatus
import ua.blackout.prewarning.data.parser.ZtoeAddressLookup
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.ui.AppStrings

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    currentQueue: String = "",
    customQueueStatusText: String? = null,
    selectedAddressQuery: SelectedAddressQuery? = null,
    activeEmergencyOutage: EmergencyOutageInfo? = null,
    siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
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
        emergencyOutage: EmergencyOutageInfo?,
        query: SelectedAddressQuery
    ) -> Unit = { _, _, _, _, _ -> },
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
    onShowAppBanner: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var showQueueHelpDialog by remember { mutableStateOf(false) }
    var showResetConfirmDialog by remember { mutableStateOf(false) }
    var queueDropdownExpanded by remember { mutableStateOf(false) }
    var advanceDropdownExpanded by remember { mutableStateOf(false) }
    var refreshDropdownExpanded by remember { mutableStateOf(false) }

    // Interactive Address Lookup state inside "?" modal
    var selectedRemId by remember(selectedAddressQuery) {
        mutableStateOf(selectedAddressQuery?.remId?.ifBlank { "zhytomyr" } ?: "zhytomyr")
    }
    var selectedSettlementId by remember(selectedAddressQuery) {
        mutableStateOf(selectedAddressQuery?.settlementId?.ifBlank { "zt_city" } ?: "zt_city")
    }
    var selectedStreetId by remember(selectedAddressQuery) {
        mutableStateOf(selectedAddressQuery?.streetId ?: "")
    }
    var selectedHouse by remember(selectedAddressQuery) {
        mutableStateOf(selectedAddressQuery?.house ?: "")
    }
    var remDropdownExpanded by remember { mutableStateOf(false) }
    var settlementDropdownExpanded by remember { mutableStateOf(false) }
    var streetDropdownExpanded by remember { mutableStateOf(false) }
    var houseDropdownExpanded by remember { mutableStateOf(false) }
    var isCheckingAddressOnSite by remember { mutableStateOf(false) }
    var addressLookupResult by remember { mutableStateOf<AddressLookupResult?>(null) }

    LaunchedEffect(autoOpenQueueHelp) {
        if (autoOpenQueueHelp) {
            showQueueHelpDialog = true
            onAutoOpenQueueHelpHandled()
        }
    }

    val queues = listOf(
        "1.1", "1.2", "2.1", "2.2", "3.1", "3.2",
        "4.1", "4.2", "5.1", "5.2", "6.1", "6.2"
    )
    val timerOptions = listOf(5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240)

    val isUrlInValidList = remember(siteUrl) { ZtoeParser.isValidUrl(siteUrl, context) }
    var urlFetchStatus by remember { mutableStateOf(FetchStatus.SUCCESS) }
    var isVerifyingUrl by remember { mutableStateOf(false) }

    // Live URL verification against valid-urls.json + actual table with current date & queues on site
    LaunchedEffect(siteUrl, currentQueue) {
        if (!ZtoeParser.isValidUrl(siteUrl, context)) {
            urlFetchStatus = FetchStatus.NO_QUEUES_FOUND
            return@LaunchedEffect
        }
        isVerifyingUrl = true
        val verifyQueue = currentQueue.ifBlank { "1.1" }
        val res = withContext(Dispatchers.IO) {
            ZtoeParser.fetchFullSchedule(siteUrl, verifyQueue, context)
        }
        urlFetchStatus = res.status
        isVerifyingUrl = false
    }

    val isSiteVerifiedSuccess = isUrlInValidList && urlFetchStatus == FetchStatus.SUCCESS

    val queueFieldDisplay = when {
        !customQueueStatusText.isNullOrBlank() ->
            if (lang == "uk") "Черга відсутня (не вимикається)" else "No queue (not disconnected)"
        currentQueue.isBlank() ->
            if (lang == "uk") "Виберіть чергу" else "Select queue"
        else -> "${AppStrings.queue(lang)} $currentQueue"
    }

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
            Icon(
                Icons.Default.Tune,
                contentDescription = null,
                tint = Color(0xFFFF5E3A),
                modifier = Modifier.size(24.dp)
            )
            Text(
                text = AppStrings.settingsTitle(lang),
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        // 1. Queue Selection Card (Frosted Glass)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Text(
                            text = AppStrings.queueTitle(lang),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = AppStrings.queueDesc(lang),
                            fontSize = 11.sp,
                            color = Color(0xB3BAE6FD)
                        )
                    }
                    // Prominent "?" button on the right matching Workbench size (40x40dp), color (#FF5E3A), and rounded-2xl (16.dp) shape
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFFFF5E3A))
                            .border(1.dp, Color(0x40FFFFFF), RoundedCornerShape(16.dp))
                            .clickable { showQueueHelpDialog = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.HelpOutline,
                            contentDescription = AppStrings.queueHelpTitle(lang),
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // Clean Native Exposed Dropdown Menu
                ExposedDropdownMenuBox(
                    expanded = queueDropdownExpanded,
                    onExpandedChange = { queueDropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = queueFieldDisplay,
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = queueDropdownExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFFF5E3A),
                            unfocusedBorderColor = Color(0x33FFFFFF),
                            focusedContainerColor = Color(0x1AFFFFFF),
                            unfocusedContainerColor = Color(0x14FFFFFF)
                        )
                    )
                    ExposedDropdownMenu(
                        expanded = queueDropdownExpanded,
                        onDismissRequest = { queueDropdownExpanded = false },
                        modifier = Modifier.background(Color(0xFF141A29))
                    ) {
                        queues.forEach { q ->
                            DropdownMenuItem(
                                text = { Text("${AppStrings.queue(lang)} $q", fontWeight = FontWeight.Bold, color = Color.White) },
                                onClick = {
                                    onQueueSelected(q)
                                    queueDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }
        }

        // 2. Site Address with Strict Verification Glyph against /valid-urls.json & live table check
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = AppStrings.siteAddressTitle(lang),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )

                    // Verification Glyph
                    val statusBadgeText = when {
                        isSiteVerifiedSuccess -> AppStrings.siteReachable(lang)
                        urlFetchStatus == FetchStatus.NO_INTERNET -> AppStrings.errorNoInternet(lang)
                        else -> AppStrings.errorNoQueuesFound(lang)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isSiteVerifiedSuccess) Color(0x3310B981) else Color(0x33EF4444))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = statusBadgeText,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isSiteVerifiedSuccess) Color(0xFF34D399) else Color(0xFFF87171)
                        )
                    }
                }

                Text(
                    text = AppStrings.siteAddressDesc(lang),
                    fontSize = 11.sp,
                    color = Color(0xB3BAE6FD)
                )

                OutlinedTextField(
                    value = siteUrl,
                    onValueChange = { onSiteUrlChanged(it) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = if (isSiteVerifiedSuccess) Color(0xFFFF5E3A) else Color(0xFFEF4444),
                        unfocusedBorderColor = if (isSiteVerifiedSuccess) Color(0x33FFFFFF) else Color(0x66EF4444),
                        focusedContainerColor = Color(0x1AFFFFFF),
                        unfocusedContainerColor = Color(0x14FFFFFF)
                    )
                )

                if (!isSiteVerifiedSuccess && !isVerifyingUrl) {
                    val errText = if (urlFetchStatus == FetchStatus.NO_INTERNET) {
                        AppStrings.errorNoInternet(lang)
                    } else {
                        AppStrings.errorNoQueuesFound(lang)
                    }
                    Text(
                        text = errText,
                        fontSize = 10.sp,
                        color = Color(0xFFF87171)
                    )
                }
            }
        }

        // 3. Timers: Native Android Spinners restricted to 1..240 (No Edit Boxes!)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                // Spinner 1: Advance Warning Notice
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = AppStrings.advanceNoticeTitle(lang),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "1–240 ${AppStrings.minShort(lang)}",
                            fontSize = 10.sp,
                            color = Color(0x99BAE6FD)
                        )
                    }

                    ExposedDropdownMenuBox(
                        expanded = advanceDropdownExpanded,
                        onExpandedChange = { advanceDropdownExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = "$advanceMinutes ${AppStrings.minShort(lang)}",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = advanceDropdownExpanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFFFF5E3A),
                                unfocusedBorderColor = Color(0x33FFFFFF),
                                focusedContainerColor = Color(0x1AFFFFFF),
                                unfocusedContainerColor = Color(0x14FFFFFF)
                            )
                        )
                        ExposedDropdownMenu(
                            expanded = advanceDropdownExpanded,
                            onDismissRequest = { advanceDropdownExpanded = false },
                            modifier = Modifier.background(Color(0xFF141A29))
                        ) {
                            timerOptions.forEach { mins ->
                                DropdownMenuItem(
                                    text = { Text("$mins ${AppStrings.minShort(lang)}", fontWeight = FontWeight.Bold, color = Color.White) },
                                    onClick = {
                                        onAdvanceMinutesChanged(mins)
                                        advanceDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                // Spinner 2: Site Refresh Interval
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = AppStrings.refreshIntervalTitle(lang),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "1–240 ${AppStrings.minShort(lang)}",
                            fontSize = 10.sp,
                            color = Color(0x99BAE6FD)
                        )
                    }

                    ExposedDropdownMenuBox(
                        expanded = refreshDropdownExpanded,
                        onExpandedChange = { refreshDropdownExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = "$refreshMinutes ${AppStrings.minShort(lang)}",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = refreshDropdownExpanded) },
                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = Color(0xFFFF5E3A),
                                unfocusedBorderColor = Color(0x33FFFFFF),
                                focusedContainerColor = Color(0x1AFFFFFF),
                                unfocusedContainerColor = Color(0x14FFFFFF)
                            )
                        )
                        ExposedDropdownMenu(
                            expanded = refreshDropdownExpanded,
                            onDismissRequest = { refreshDropdownExpanded = false },
                            modifier = Modifier.background(Color(0xFF141A29))
                        ) {
                            timerOptions.forEach { mins ->
                                DropdownMenuItem(
                                    text = { Text("$mins ${AppStrings.minShort(lang)}", fontWeight = FontWeight.Bold, color = Color.White) },
                                    onClick = {
                                        onRefreshMinutesChanged(mins)
                                        refreshDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // 4. Notification Toggles (Sound & Vibration shared by Notifications and Emergency Power Outages)
        val anyAlertsEnabled = notificationsEnabled || emergencyNotificationsEnabled
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(AppStrings.notifications(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                    Switch(
                        checked = notificationsEnabled,
                        onCheckedChange = onToggleNotifications,
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFFFF5E3A),
                            uncheckedThumbColor = Color.LightGray,
                            uncheckedTrackColor = Color(0x33FFFFFF)
                        )
                    )
                }

                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.VolumeUp,
                            contentDescription = null,
                            tint = if (anyAlertsEnabled) Color(0xB3BAE6FD) else Color(0x4DBAE6FD),
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = AppStrings.sound(lang),
                            fontSize = 12.sp,
                            color = if (anyAlertsEnabled) Color.White else Color(0x66FFFFFF)
                        )
                    }
                    Switch(
                        checked = anyAlertsEnabled && soundEnabled,
                        onCheckedChange = onToggleSound,
                        enabled = anyAlertsEnabled,
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFFFF5E3A),
                            uncheckedThumbColor = Color.LightGray,
                            uncheckedTrackColor = Color(0x33FFFFFF),
                            disabledCheckedTrackColor = Color(0x33FF5E3A),
                            disabledUncheckedTrackColor = Color(0x1AFFFFFF),
                            disabledUncheckedThumbColor = Color(0x4DFFFFFF)
                        )
                    )
                }

                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Vibration,
                            contentDescription = null,
                            tint = if (anyAlertsEnabled) Color(0xB3BAE6FD) else Color(0x4DBAE6FD),
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = AppStrings.vibration(lang),
                            fontSize = 12.sp,
                            color = if (anyAlertsEnabled) Color.White else Color(0x66FFFFFF)
                        )
                    }
                    Switch(
                        checked = anyAlertsEnabled && vibrationEnabled,
                        onCheckedChange = onToggleVibration,
                        enabled = anyAlertsEnabled,
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = Color(0xFFFF5E3A),
                            uncheckedThumbColor = Color.LightGray,
                            uncheckedTrackColor = Color(0x33FFFFFF),
                            disabledCheckedTrackColor = Color(0x33FF5E3A),
                            disabledUncheckedTrackColor = Color(0x1AFFFFFF),
                            disabledUncheckedThumbColor = Color(0x4DFFFFFF)
                        )
                    )
                }
            }
        }

        // 4b. Emergency Power Outages Switch (Separate block below Notifications block; always visible even when no outages detected; ON by default)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .padding(end = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = Color(0xFFFF5E3A),
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = AppStrings.emergencyNotifications(lang),
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
                Switch(
                    checked = emergencyNotificationsEnabled,
                    onCheckedChange = onToggleEmergencyNotifications,
                    enabled = true,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = Color(0xFFFF5E3A),
                        uncheckedThumbColor = Color.LightGray,
                        uncheckedTrackColor = Color(0x33FFFFFF)
                    )
                )
            }
        }

        // 5. Language Selection Card (Dynamic Localization!)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Language,
                        contentDescription = null,
                        tint = Color(0xFFFF5E3A),
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        text = AppStrings.languageTitle(lang),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0x59000000))
                        .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf("SYSTEM" to (if (lang == "uk") "Системна" else "System"), "uk" to "Українська", "en" to "English").forEach { (code, label) ->
                        val isSelected = currentLanguage.equals(code, ignoreCase = true)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(9.dp))
                                .background(if (isSelected) Color.White else Color.Transparent)
                                .clickable { onLanguageSelected(code) }
                                .padding(vertical = 8.dp, horizontal = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
                                color = if (isSelected) Color.Black else Color(0xBFE0F2FE)
                            )
                        }
                    }
                }
            }
        }

        // 6. Diagnostics & Actions Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(24.dp))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Send Test Alert Button (Respects Sound & Vibration)
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFFFF5E3A))
                            .clickable {
                                onSendTestAlert()
                                onShowAppBanner(if (lang == "uk") "Тестове сповіщення надіслано" else "Test alert dispatched")
                            }
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(Icons.Default.Send, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                            Text(AppStrings.testAlertBtn(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }

                    // Refresh Button with In-App Application Icon Notification Banner
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0x1AFFFFFF))
                            .border(1.dp, Color(0x26FFFFFF), RoundedCornerShape(16.dp))
                            .clickable {
                                onForceRefresh()
                            }
                            .padding(vertical = 12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(Icons.Default.Language, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                            Text(AppStrings.refreshBtn(lang), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = Color.White)
                        }
                    }
                }

                // Reset to Defaults
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(16.dp))
                        .clickable { showResetConfirmDialog = true }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, tint = Color(0xB3BAE6FD), modifier = Modifier.size(14.dp))
                        Text(AppStrings.resetDefaultsBtn(lang), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = Color(0xB3BAE6FD))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(96.dp))
    }

    // =========================================================================================
    // Full-Screen Queue Help & Interactive ZTOE Address Lookup Dialog ("?" Button)
    // =========================================================================================
    if (showQueueHelpDialog) {
        var allRems by remember {
            mutableStateOf(ZtoeAddressLookup.getRems())
        }
        val currentRem = allRems.find { it.id == selectedRemId } ?: allRems.first()

        var settlementsList by remember(selectedRemId) {
            mutableStateOf(ZtoeAddressLookup.getSettlementsForRem(selectedRemId))
        }
        var streetsList by remember(selectedSettlementId) {
            mutableStateOf(
                if (selectedSettlementId.isNotBlank()) {
                    ZtoeAddressLookup.getStreetsForSettlement(selectedSettlementId)
                } else {
                    emptyList()
                }
            )
        }
        var housesList by remember(selectedStreetId) {
            mutableStateOf(
                if (selectedStreetId.isNotBlank()) {
                    ZtoeAddressLookup.getHousesForStreet(selectedStreetId)
                } else {
                    emptyList()
                }
            )
        }

        // Refresh the list of all REMs, Cities, Streets and Houses whenever User enters the "?" screen
        LaunchedEffect(siteUrl) {
            val fetchedRems = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.fetchRemsFromZtoe(siteUrl, forceRefresh = true)
            }
            if (fetchedRems.isNotEmpty()) {
                allRems = fetchedRems
            }
        }

        // Dynamically load full settlement list for selected REM from ZTOE (refreshed when entering "?" screen)
        LaunchedEffect(selectedRemId, siteUrl) {
            val fetched = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.fetchSettlementsForRem(selectedRemId, siteUrl, forceRefresh = true)
            }
            if (fetched.isNotEmpty()) {
                settlementsList = fetched
                if (selectedSettlementId.isBlank() || fetched.none { it.id == selectedSettlementId }) {
                    selectedSettlementId = fetched.first().id
                }
            }
        }

        // Dynamically load full street list (and bulk-index all houses for every street in the settlement) from ZTOE
        LaunchedEffect(selectedRemId, selectedSettlementId, siteUrl) {
            if (selectedSettlementId.isBlank()) {
                streetsList = emptyList()
                return@LaunchedEffect
            }
            val fetched = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.fetchStreetsForSettlement(selectedRemId, selectedSettlementId, siteUrl, forceRefresh = true)
            }
            if (fetched.isNotEmpty()) {
                streetsList = fetched
                allRems = ZtoeAddressLookup.getRems()
                settlementsList = ZtoeAddressLookup.getSettlementsForRem(selectedRemId)
                if (selectedStreetId.isNotBlank()) {
                    val bulkIndexed = ZtoeAddressLookup.getHousesForStreet(selectedStreetId)
                    if (bulkIndexed.isNotEmpty()) {
                        housesList = bulkIndexed
                    }
                }
            }
        }

        // Dynamically load full house list for selected street from ZTOE (served in 0ms when already bulk-indexed)
        LaunchedEffect(selectedRemId, selectedSettlementId, selectedStreetId, siteUrl) {
            if (selectedStreetId.isBlank()) {
                housesList = emptyList()
                return@LaunchedEffect
            }
            housesList = ZtoeAddressLookup.getHousesForStreet(selectedStreetId)
            val fetched = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.fetchHousesForStreet(selectedRemId, selectedSettlementId, selectedStreetId, siteUrl, forceRefresh = true)
            }
            if (fetched.isNotEmpty()) {
                housesList = fetched
            }
        }

        val currentSettlement = settlementsList.find { it.id == selectedSettlementId }
            ?: ZtoeAddressLookup.findSettlementById(selectedSettlementId)
            ?: settlementsList.firstOrNull()
        val currentStreet = streetsList.find { it.id == selectedStreetId }
            ?: ZtoeAddressLookup.findStreetById(selectedStreetId)
        val currentHouseRecord = housesList.find { it.house.equals(selectedHouse, ignoreCase = true) }

        // Automatically query ZTOE when a valid street and house are selected (do NOT close or apply until user clicks button)
        LaunchedEffect(selectedRemId, selectedSettlementId, selectedStreetId, selectedHouse) {
            addressLookupResult = null
            if (selectedStreetId.isBlank() || selectedHouse.isBlank()) {
                isCheckingAddressOnSite = false
                return@LaunchedEffect
            }
            isCheckingAddressOnSite = true
            val res = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                    remId = selectedRemId,
                    settlementId = selectedSettlementId,
                    streetId = selectedStreetId,
                    house = selectedHouse,
                    siteUrl = siteUrl
                )
            }
            isCheckingAddressOnSite = false
            addressLookupResult = res
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
                                emergencyOutage = res.emergencyOutage ?: h.emergencyOutage,
                                addressLabel = res.addressLabel.ifEmpty { h.addressLabel }
                            )
                        } else h
                    }
                }
            }
        }

        val selectedAddressStr = if (currentStreet != null && selectedHouse.isNotBlank()) {
            val remName = if (lang == "uk") currentRem.nameUk else currentRem.nameEn
            val settlementName = if (currentSettlement != null) {
                if (lang == "uk") currentSettlement.nameUk else currentSettlement.nameEn
            } else ""
            val streetName = if (lang == "uk") currentStreet.nameUk else currentStreet.nameEn
            val housePrefix = if (lang == "uk") "буд." else "bldg."
            "$remName, $settlementName,\n$streetName, $housePrefix $selectedHouse"
        } else {
            ""
        }

        Dialog(
            onDismissRequest = { showQueueHelpDialog = false },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF141A29))
                    .statusBarsPadding()
                    .navigationBarsPadding()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 14.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    // Modal Header matching Workbench
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp),
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
                                        .background(Color(0xFFFF5E3A)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "?",
                                        fontSize = 20.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color.White
                                    )
                                }
                                Text(
                                    text = AppStrings.queueHelpTitle(lang),
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(CircleShape)
                                    .background(Color(0x1AFFFFFF))
                                    .border(1.dp, Color(0x26FFFFFF), CircleShape)
                                    .clickable { showQueueHelpDialog = false },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Close",
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x33FFFFFF)))
                    }

                    // 1) Interactive Search by Address Card matching Workbench
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
                                    text = (if (lang == "uk") "Пошук черги за адресою" else "Find Queue by Address").uppercase(),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White,
                                    letterSpacing = 0.8.sp
                                )
                                Text(
                                    text = AppStrings.queueHelpAddressSubtitle(lang),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Color(0xCCBAE6FD)
                                )
                            }

                            // 1. РЕМ Dropdown
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = if (lang == "uk") "РЕМ" else "District (РЕМ)",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xE6BAE6FD)
                                )
                                ExposedDropdownMenuBox(
                                    expanded = remDropdownExpanded,
                                    onExpandedChange = { remDropdownExpanded = it }
                                ) {
                                    OutlinedTextField(
                                        value = if (lang == "uk") currentRem.nameUk else currentRem.nameEn,
                                        onValueChange = {},
                                        readOnly = true,
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = remDropdownExpanded) },
                                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                                        shape = RoundedCornerShape(16.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedBorderColor = Color(0xFFFF5E3A),
                                            unfocusedBorderColor = Color(0x33FFFFFF),
                                            focusedContainerColor = Color(0x14FFFFFF),
                                            unfocusedContainerColor = Color(0x14FFFFFF)
                                        )
                                    )
                                    ExposedDropdownMenu(
                                        expanded = remDropdownExpanded,
                                        onDismissRequest = { remDropdownExpanded = false },
                                        modifier = Modifier
                                            .background(Color(0xFF141A29))
                                            .heightIn(max = 320.dp)
                                    ) {
                                        allRems.forEach { rem ->
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        if (lang == "uk") rem.nameUk else rem.nameEn,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White
                                                    )
                                                },
                                                onClick = {
                                                    selectedRemId = rem.id
                                                    val nextSettlements = ZtoeAddressLookup.getSettlementsForRem(rem.id)
                                                    settlementsList = nextSettlements
                                                    val nextSettlementId = nextSettlements.firstOrNull()?.id ?: ""
                                                    selectedSettlementId = nextSettlementId
                                                    streetsList = if (nextSettlementId.isNotBlank()) {
                                                        ZtoeAddressLookup.getStreetsForSettlement(nextSettlementId)
                                                    } else {
                                                        emptyList()
                                                    }
                                                    selectedStreetId = ""
                                                    housesList = emptyList()
                                                    selectedHouse = ""
                                                    addressLookupResult = null
                                                    remDropdownExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }

                            // 2. Населений пункт Dropdown
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = if (lang == "uk") "Населений пункт" else "City / Settlement",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xE6BAE6FD)
                                )
                                ExposedDropdownMenuBox(
                                    expanded = settlementDropdownExpanded,
                                    onExpandedChange = { settlementDropdownExpanded = it }
                                ) {
                                    val settlementDisplay = if (currentSettlement != null) {
                                        if (lang == "uk") currentSettlement.nameUk else currentSettlement.nameEn
                                    } else {
                                        if (lang == "uk") "Оберіть населений пункт" else "Select settlement"
                                    }
                                    OutlinedTextField(
                                        value = settlementDisplay,
                                        onValueChange = {},
                                        readOnly = true,
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = settlementDropdownExpanded) },
                                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                                        shape = RoundedCornerShape(16.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedBorderColor = Color(0xFFFF5E3A),
                                            unfocusedBorderColor = Color(0x33FFFFFF),
                                            focusedContainerColor = Color(0x14FFFFFF),
                                            unfocusedContainerColor = Color(0x14FFFFFF)
                                        )
                                    )
                                    ExposedDropdownMenu(
                                        expanded = settlementDropdownExpanded,
                                        onDismissRequest = { settlementDropdownExpanded = false },
                                        modifier = Modifier
                                            .background(Color(0xFF141A29))
                                            .heightIn(max = 320.dp)
                                    ) {
                                        settlementsList.forEach { settlement ->
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        if (lang == "uk") settlement.nameUk else settlement.nameEn,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White
                                                    )
                                                },
                                                onClick = {
                                                    selectedSettlementId = settlement.id
                                                    streetsList = ZtoeAddressLookup.getStreetsForSettlement(settlement.id)
                                                    selectedStreetId = ""
                                                    housesList = emptyList()
                                                    selectedHouse = ""
                                                    addressLookupResult = null
                                                    settlementDropdownExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }

                            // 3. Вулиця Dropdown (unselected by default on first launch)
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = if (lang == "uk") "Вулиця" else "Street",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xE6BAE6FD)
                                )
                                ExposedDropdownMenuBox(
                                    expanded = streetDropdownExpanded,
                                    onExpandedChange = { streetDropdownExpanded = it }
                                ) {
                                    val streetDisplay = when {
                                        currentStreet == null -> if (lang == "uk") "Оберіть вулицю" else "Select street"
                                        lang == "uk" -> currentStreet.nameUk
                                        else -> currentStreet.nameEn
                                    }
                                    OutlinedTextField(
                                        value = streetDisplay,
                                        onValueChange = {},
                                        readOnly = true,
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = streetDropdownExpanded) },
                                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                                        shape = RoundedCornerShape(16.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            focusedBorderColor = Color(0xFFFF5E3A),
                                            unfocusedBorderColor = Color(0x33FFFFFF),
                                            focusedContainerColor = Color(0x14FFFFFF),
                                            unfocusedContainerColor = Color(0x14FFFFFF)
                                        )
                                    )
                                    ExposedDropdownMenu(
                                        expanded = streetDropdownExpanded,
                                        onDismissRequest = { streetDropdownExpanded = false },
                                        modifier = Modifier
                                            .background(Color(0xFF141A29))
                                            .heightIn(max = 320.dp)
                                    ) {
                                        streetsList.forEach { street ->
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        if (lang == "uk") street.nameUk else street.nameEn,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White
                                                    )
                                                },
                                                onClick = {
                                                    selectedStreetId = street.id
                                                    housesList = ZtoeAddressLookup.getHousesForStreet(street.id)
                                                    selectedHouse = ""
                                                    addressLookupResult = null
                                                    streetDropdownExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }

                            // 4. Будинок Dropdown (unselected by default on first launch)
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = if (lang == "uk") "Будинок" else "House Number",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xE6BAE6FD)
                                )
                                ExposedDropdownMenuBox(
                                    expanded = houseDropdownExpanded,
                                    onExpandedChange = {
                                        if (currentStreet != null) {
                                            houseDropdownExpanded = it
                                        }
                                    }
                                ) {
                                    val houseDisplay = when {
                                        selectedHouse.isBlank() -> if (lang == "uk") "Оберіть будинок" else "Select house"
                                        else -> selectedHouse
                                    }
                                    OutlinedTextField(
                                        value = houseDisplay,
                                        onValueChange = {},
                                        readOnly = true,
                                        enabled = currentStreet != null,
                                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = houseDropdownExpanded) },
                                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                                        shape = RoundedCornerShape(16.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White,
                                            disabledTextColor = Color(0x80FFFFFF),
                                            focusedBorderColor = Color(0xFFFF5E3A),
                                            unfocusedBorderColor = Color(0x33FFFFFF),
                                            disabledBorderColor = Color(0x1AFFFFFF),
                                            focusedContainerColor = Color(0x14FFFFFF),
                                            unfocusedContainerColor = Color(0x14FFFFFF),
                                            disabledContainerColor = Color(0x0DFFFFFF)
                                        )
                                    )
                                    ExposedDropdownMenu(
                                        expanded = houseDropdownExpanded,
                                        onDismissRequest = { houseDropdownExpanded = false },
                                        modifier = Modifier
                                            .background(Color(0xFF141A29))
                                            .heightIn(max = 320.dp)
                                    ) {
                                        housesList.forEach { h ->
                                            DropdownMenuItem(
                                                text = {
                                                    Text(
                                                        h.house,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color.White
                                                    )
                                                },
                                                onClick = {
                                                    selectedHouse = h.house
                                                    addressLookupResult = null
                                                    houseDropdownExpanded = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }

                            // Result Card matching Workbench (shown when a house is selected)
                            val validLookupResult = addressLookupResult?.takeIf {
                                it.house.equals(selectedHouse, ignoreCase = true)
                            }
                            val matchedRecord = when {
                                validLookupResult != null && currentHouseRecord != null -> validLookupResult.copy(
                                    queue = validLookupResult.queue.ifEmpty { currentHouseRecord.queue },
                                    statusText = validLookupResult.statusText ?: currentHouseRecord.statusText,
                                    emergencyOutage = validLookupResult.emergencyOutage ?: currentHouseRecord.emergencyOutage
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
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = Color(0xE6BAE6FD),
                                                lineHeight = 19.sp
                                            )
                                        }

                                        if (matchedRecord.queue.isNotBlank()) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = if (lang == "uk") "Знайдена черга:" else "Found Queue:",
                                                    fontSize = 14.sp,
                                                    fontWeight = FontWeight.Medium,
                                                    color = Color(0xCCBAE6FD)
                                                )
                                                Text(
                                                    text = "${AppStrings.queue(lang)} ${matchedRecord.queue}",
                                                    fontSize = 16.sp,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    fontFamily = FontFamily.Monospace,
                                                    color = Color.White
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
                                                    fontSize = 14.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color.White,
                                                    lineHeight = 19.sp
                                                )
                                            }
                                        }

                                        val emerg = matchedRecord.emergencyOutage
                                        if (emerg != null) {
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clip(RoundedCornerShape(16.dp))
                                                    .background(Color(0x1AFF5E3A))
                                                    .border(2.dp, Color(0x59FF5E3A), RoundedCornerShape(16.dp))
                                                    .padding(horizontal = 16.dp, vertical = 12.dp)
                                            ) {
                                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                                    Text(
                                                        text = if (lang == "uk") {
                                                            emerg.outageType.ifBlank { "Аварійне відключення" }
                                                        } else {
                                                            "Emergency Outage"
                                                        },
                                                        fontSize = 14.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Color(0xFFFF5E3A)
                                                    )
                                                    Text(
                                                        text = if (lang == "uk") {
                                                            "Початок: ${emerg.startTime} · Відновлення: ${emerg.estimatedRestoreTime}"
                                                        } else {
                                                            "Start: ${emerg.startTime} · Restore: ${emerg.estimatedRestoreTime}"
                                                        },
                                                        fontSize = 12.sp,
                                                        fontFamily = FontFamily.Monospace,
                                                        color = Color.White
                                                    )
                                                }
                                            }
                                        }

                                        // Full-width "Обрати чергу X.Y" / "Apply Queue X.Y" button UNDER address matching Workbench
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(16.dp))
                                                .background(Color(0xFFFF5E3A))
                                                .clickable {
                                                    val query = SelectedAddressQuery(
                                                        remId = selectedRemId,
                                                        settlementId = selectedSettlementId,
                                                        streetId = selectedStreetId,
                                                        house = selectedHouse
                                                    )
                                                    val addressToSave = selectedAddressStr.ifBlank { matchedRecord.addressLabel }
                                                    if (matchedRecord.queue.isNotBlank()) {
                                                        onAddressQueueResolved(
                                                            matchedRecord.queue,
                                                            null,
                                                            addressToSave,
                                                            matchedRecord.emergencyOutage,
                                                            query
                                                        )
                                                        showQueueHelpDialog = false
                                                        onShowAppBanner("${AppStrings.queue(lang)} ${matchedRecord.queue}")
                                                    } else {
                                                        onAddressQueueResolved(
                                                            "",
                                                            matchedRecord.statusText,
                                                            addressToSave,
                                                            matchedRecord.emergencyOutage,
                                                            query
                                                        )
                                                        showQueueHelpDialog = false
                                                        onShowAppBanner(
                                                            matchedRecord.statusText
                                                                ?: if (lang == "uk") "Адресу збережено" else "Address saved"
                                                        )
                                                    }
                                                }
                                                .padding(vertical = 14.dp, horizontal = 16.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = if (matchedRecord.queue.isNotBlank()) {
                                                    if (lang == "uk") "Обрати чергу ${matchedRecord.queue}" else "Apply Queue ${matchedRecord.queue}"
                                                } else {
                                                    if (lang == "uk") "Підтвердити вибір" else "Confirm selection"
                                                },
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color.White
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 2) "Пошук вручну" / "Manual search" Heading matching Workbench
                    Text(
                        text = AppStrings.queueHelpManualSearchTitle(lang).uppercase(),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White,
                        letterSpacing = 0.8.sp,
                        modifier = Modifier.padding(top = 4.dp, start = 4.dp)
                    )

                    // 3) Numbered instructions 1-4 inside cards matching Workbench
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
                                            .size(24.dp)
                                            .clip(CircleShape)
                                            .background(Color(0x26FFFFFF)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "${idx + 1}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace,
                                            color = Color.White
                                        )
                                    }
                                    val targetUrl = "https://www.ztoe.com.ua/unhooking-search.php"
                                    val urlStart = step.indexOf(targetUrl)
                                    if (urlStart >= 0) {
                                        val urlEnd = urlStart + targetUrl.length
                                        val annotatedStep = buildAnnotatedString {
                                            append(step)
                                            addStyle(
                                                style = SpanStyle(
                                                    color = Color(0xFFFF5E3A),
                                                    fontWeight = FontWeight.SemiBold,
                                                    textDecoration = TextDecoration.Underline
                                                ),
                                                start = urlStart,
                                                end = urlEnd
                                            )
                                        }
                                        Text(
                                            text = annotatedStep,
                                            color = Color(0xFFF4F4F5),
                                            fontSize = 14.sp,
                                            lineHeight = 20.sp,
                                            modifier = Modifier
                                                .weight(1f)
                                                .clickable {
                                                    try {
                                                        val intent = android.content.Intent(
                                                            android.content.Intent.ACTION_VIEW,
                                                            android.net.Uri.parse(targetUrl)
                                                        )
                                                        context.startActivity(intent)
                                                    } catch (_: Exception) {}
                                                }
                                        )
                                    } else {
                                        Text(
                                            text = step,
                                            color = Color(0xFFF4F4F5),
                                            fontSize = 14.sp,
                                            lineHeight = 20.sp,
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Bottom "Зрозуміло" / "Got it" button matching Workbench (white bg, black text)
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .clickable { showQueueHelpDialog = false }
                            .padding(vertical = 14.dp, horizontal = 20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = AppStrings.queueHelpGotIt(lang),
                            color = Color.Black,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }
                }
            }
        }
    }

    // Reset Confirm Dialog
    if (showResetConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showResetConfirmDialog = false },
            title = { Text(AppStrings.resetConfirmTitle(lang), fontWeight = FontWeight.Bold, color = Color.White) },
            text = { Text(AppStrings.resetConfirmDesc(lang), color = Color.LightGray) },
            confirmButton = {
                TextButton(onClick = {
                    onResetDefaults()
                    showResetConfirmDialog = false
                    onShowAppBanner(if (lang == "uk") "Налаштування скинуто" else "Settings reset")
                }) {
                    Text(AppStrings.resetYes(lang), color = Color(0xFFFF5E3A), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showResetConfirmDialog = false }) {
                    Text(AppStrings.cancel(lang), color = Color.White)
                }
            },
            containerColor = Color(0xFF141A29)
        )
    }
}
