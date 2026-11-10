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
    siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
    // CRITICAL CONSTANTS — Default values: advanceMinutes = 15, refreshMinutes = 30. Never modify on your own.
    advanceMinutes: Int = 15,
    refreshMinutes: Int = 30,
    notificationsEnabled: Boolean = true,
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
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = AppStrings.queueTitle(lang),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Box(
                            modifier = Modifier
                                .size(22.dp)
                                .clip(CircleShape)
                                .background(Color(0x26FFFFFF))
                                .clickable { showQueueHelpDialog = true },
                            contentAlignment = Alignment.Center
                        ) {
                            Text("?", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }
                }
                Text(
                    text = AppStrings.queueDesc(lang),
                    fontSize = 11.sp,
                    color = Color(0xB3BAE6FD)
                )

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

        // 4. Notification Toggles (All synchronized; Sound & Vibration turn off and disable when Notifications are off)
        Box(
            modifier = Modifier
                .fillMaxWidth()
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
                    Text(AppStrings.notifications(lang), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
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
                    Text(
                        text = AppStrings.sound(lang),
                        fontSize = 13.sp,
                        color = if (notificationsEnabled) Color.White else Color(0x66FFFFFF)
                    )
                    Switch(
                        checked = notificationsEnabled && soundEnabled,
                        onCheckedChange = onToggleSound,
                        enabled = notificationsEnabled,
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
                    Text(
                        text = AppStrings.vibration(lang),
                        fontSize = 13.sp,
                        color = if (notificationsEnabled) Color.White else Color(0x66FFFFFF)
                    )
                    Switch(
                        checked = notificationsEnabled && vibrationEnabled,
                        onCheckedChange = onToggleVibration,
                        enabled = notificationsEnabled,
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

        // 5. Language Selection Card (Dynamic Localization!)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = AppStrings.languageTitle(lang),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("SYSTEM" to (if (lang == "uk") "Системна" else "System"), "uk" to "Українська", "en" to "English").forEach { (code, label) ->
                        val isSelected = currentLanguage.equals(code, ignoreCase = true)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(if (isSelected) Color.White else Color(0x1AFFFFFF))
                                .clickable { onLanguageSelected(code) }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isSelected) Color.Black else Color(0xB3BAE6FD)
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
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
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
                            .background(Color(0x26FFFFFF))
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
                            Icon(Icons.Default.Refresh, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                            Text(AppStrings.refreshBtn(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }
                }

                // Reset to Defaults
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .clickable { showResetConfirmDialog = true }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(AppStrings.resetDefaultsBtn(lang), fontSize = 12.sp, color = Color(0x99BAE6FD))
                }
            }
        }

        Spacer(modifier = Modifier.height(96.dp))
    }

    // =========================================================================================
    // Full-Screen Queue Help & Interactive ZTOE Address Lookup Dialog ("?" Button)
    // =========================================================================================
    if (showQueueHelpDialog) {
        val currentRem = ZtoeAddressLookup.DIRECTORY.find { it.id == selectedRemId } ?: ZtoeAddressLookup.DIRECTORY.first()
        val currentSettlement = currentRem.settlements.find { it.id == selectedSettlementId } ?: currentRem.settlements.first()
        val currentStreet = currentSettlement.streets.find { it.id == selectedStreetId }
        val currentHouseRecord = currentStreet?.houses?.find { it.house == selectedHouse }

        // Automatically query ZTOE when a valid street and house are selected
        LaunchedEffect(selectedRemId, selectedSettlementId, selectedStreetId, selectedHouse) {
            if (selectedStreetId.isBlank() || selectedHouse.isBlank()) {
                addressLookupResult = null
                isCheckingAddressOnSite = false
                return@LaunchedEffect
            }
            isCheckingAddressOnSite = true
            val res = withContext(Dispatchers.IO) {
                ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                    remId = selectedRemId,
                    settlementId = selectedSettlementId,
                    streetId = selectedStreetId,
                    house = selectedHouse
                )
            }
            isCheckingAddressOnSite = false
            addressLookupResult = res
            if (res != null) {
                val query = SelectedAddressQuery(
                    remId = selectedRemId,
                    settlementId = selectedSettlementId,
                    streetId = selectedStreetId,
                    house = selectedHouse
                )
                if (!res.queue.isNullOrBlank()) {
                    onAddressQueueResolved(res.queue, null, res.addressLabel, res.emergencyOutage, query)
                } else if (!res.statusText.isNullOrBlank()) {
                    onAddressQueueResolved("", res.statusText, res.addressLabel, res.emergencyOutage, query)
                }
            }
        }

        Dialog(
            onDismissRequest = { showQueueHelpDialog = false },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFA0F1420))
                    .statusBarsPadding()
                    .navigationBarsPadding()
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    // Top Sticky Bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF141A29))
                            .padding(horizontal = 20.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = AppStrings.queueHelpTitle(lang),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            modifier = Modifier.weight(1f)
                        )
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(Color(0x1AFFFFFF))
                                .clickable { showQueueHelpDialog = false },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = "Close",
                                tint = Color.White,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }

                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                    // Scrollable Body: 1) Interactive Address Search, 2) "Пошук вручну" heading, 3) Numbered steps 1-4
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 20.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // 1) Interactive Search by Address Card with 2dp internal border
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(20.dp))
                                .background(Color(0xE6141A29))
                                .border(2.dp, Color.White.copy(alpha = 0.25f), RoundedCornerShape(20.dp))
                                .padding(16.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (lang == "uk") "Пошук черги за адресою" else "Find Queue by Address",
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color.White
                                    )
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(Color(0x26FF5E3A))
                                            .padding(horizontal = 8.dp, vertical = 3.dp)
                                    ) {
                                        Text(
                                            text = "ztoe.com.ua",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace,
                                            color = Color(0xFFFF5E3A)
                                        )
                                    }
                                }

                                // 1. РЕМ Dropdown
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        text = if (lang == "uk") "1. РЕМ (Район електромереж)" else "1. Distribution District (РЕМ)",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xCCBAE6FD)
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
                                            shape = RoundedCornerShape(14.dp),
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
                                            expanded = remDropdownExpanded,
                                            onDismissRequest = { remDropdownExpanded = false },
                                            modifier = Modifier.background(Color(0xFF141A29))
                                        ) {
                                            ZtoeAddressLookup.DIRECTORY.forEach { rem ->
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
                                                        val firstSettlement = rem.settlements.firstOrNull()
                                                        selectedSettlementId = firstSettlement?.id ?: ""
                                                        selectedStreetId = ""
                                                        selectedHouse = ""
                                                        remDropdownExpanded = false
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }

                                // 2. Населений пункт Dropdown
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        text = if (lang == "uk") "2. Населений пункт" else "2. Settlement",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xCCBAE6FD)
                                    )
                                    ExposedDropdownMenuBox(
                                        expanded = settlementDropdownExpanded,
                                        onExpandedChange = { settlementDropdownExpanded = it }
                                    ) {
                                        OutlinedTextField(
                                            value = if (lang == "uk") currentSettlement.nameUk else currentSettlement.nameEn,
                                            onValueChange = {},
                                            readOnly = true,
                                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = settlementDropdownExpanded) },
                                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                                            shape = RoundedCornerShape(14.dp),
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
                                            expanded = settlementDropdownExpanded,
                                            onDismissRequest = { settlementDropdownExpanded = false },
                                            modifier = Modifier.background(Color(0xFF141A29))
                                        ) {
                                            currentRem.settlements.forEach { settlement ->
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
                                                        selectedStreetId = ""
                                                        selectedHouse = ""
                                                        settlementDropdownExpanded = false
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }

                                // 3. Вулиця Dropdown (unselected by default on first launch)
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        text = if (lang == "uk") "3. Вулиця" else "3. Street",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xCCBAE6FD)
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
                                            shape = RoundedCornerShape(14.dp),
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
                                            expanded = streetDropdownExpanded,
                                            onDismissRequest = { streetDropdownExpanded = false },
                                            modifier = Modifier.background(Color(0xFF141A29))
                                        ) {
                                            currentSettlement.streets.forEach { street ->
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
                                                        selectedHouse = ""
                                                        streetDropdownExpanded = false
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }

                                // 4. Будинок Dropdown (unselected by default on first launch)
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        text = if (lang == "uk") "4. Будинок" else "4. Building / House",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xCCBAE6FD)
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
                                            currentHouseRecord == null -> if (lang == "uk") "Оберіть будинок" else "Select house"
                                            else -> "${if (lang == "uk") "буд." else "bldg."} ${currentHouseRecord.house}"
                                        }
                                        OutlinedTextField(
                                            value = houseDisplay,
                                            onValueChange = {},
                                            readOnly = true,
                                            enabled = currentStreet != null,
                                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = houseDropdownExpanded) },
                                            modifier = Modifier.menuAnchor().fillMaxWidth(),
                                            shape = RoundedCornerShape(14.dp),
                                            colors = OutlinedTextFieldDefaults.colors(
                                                focusedTextColor = Color.White,
                                                unfocusedTextColor = Color.White,
                                                disabledTextColor = Color(0x80FFFFFF),
                                                focusedBorderColor = Color(0xFFFF5E3A),
                                                unfocusedBorderColor = Color(0x33FFFFFF),
                                                disabledBorderColor = Color(0x1AFFFFFF),
                                                focusedContainerColor = Color(0x1AFFFFFF),
                                                unfocusedContainerColor = Color(0x14FFFFFF),
                                                disabledContainerColor = Color(0x0DFFFFFF)
                                            )
                                        )
                                        ExposedDropdownMenu(
                                            expanded = houseDropdownExpanded,
                                            onDismissRequest = { houseDropdownExpanded = false },
                                            modifier = Modifier.background(Color(0xFF141A29))
                                        ) {
                                            currentStreet?.houses?.forEach { h ->
                                                DropdownMenuItem(
                                                    text = {
                                                        Text(
                                                            "${if (lang == "uk") "буд." else "bldg."} ${h.house}",
                                                            fontWeight = FontWeight.Bold,
                                                            color = Color.White
                                                        )
                                                    },
                                                    onClick = {
                                                        selectedHouse = h.house
                                                        houseDropdownExpanded = false
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }

                                // Result & Live Site Check Row
                                val resolvedLookup = addressLookupResult
                                if (resolvedLookup != null && !resolvedLookup.statusText.isNullOrBlank()) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(Color(0x2610B981))
                                            .border(1.dp, Color(0x6634D399), RoundedCornerShape(14.dp))
                                            .padding(12.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = resolvedLookup.statusText,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                } else {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(Color(0x33000000))
                                            .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(14.dp))
                                            .padding(horizontal = 12.dp, vertical = 10.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = if (lang == "uk") "Визначена підчерга:" else "Detected sub-queue:",
                                                fontSize = 11.sp,
                                                color = Color(0xB3BAE6FD)
                                            )
                                            val detectedQ = resolvedLookup?.queue ?: currentHouseRecord?.queue
                                            Text(
                                                text = if (!detectedQ.isNullOrBlank()) {
                                                    "${AppStrings.queue(lang)} $detectedQ"
                                                } else {
                                                    "—"
                                                },
                                                fontSize = 16.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                fontFamily = FontFamily.Monospace,
                                                color = if (!detectedQ.isNullOrBlank()) Color(0xFFFF5E3A) else Color(0x80FFFFFF)
                                            )
                                        }

                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(12.dp))
                                                .background(if (selectedStreetId.isNotBlank() && selectedHouse.isNotBlank()) Color(0xFFFF5E3A) else Color(0x33FFFFFF))
                                                .clickable(enabled = selectedStreetId.isNotBlank() && selectedHouse.isNotBlank() && !isCheckingAddressOnSite) {
                                                    coroutineScope.launch {
                                                        isCheckingAddressOnSite = true
                                                        val res = withContext(Dispatchers.IO) {
                                                            ZtoeAddressLookup.checkAddressOnZtoeWebsite(
                                                                remId = selectedRemId,
                                                                settlementId = selectedSettlementId,
                                                                streetId = selectedStreetId,
                                                                house = selectedHouse
                                                            )
                                                        }
                                                        isCheckingAddressOnSite = false
                                                        addressLookupResult = res
                                                        if (res != null) {
                                                            val query = SelectedAddressQuery(
                                                                remId = selectedRemId,
                                                                settlementId = selectedSettlementId,
                                                                streetId = selectedStreetId,
                                                                house = selectedHouse
                                                            )
                                                            if (!res.queue.isNullOrBlank()) {
                                                                onAddressQueueResolved(res.queue, null, res.addressLabel, res.emergencyOutage, query)
                                                            } else if (!res.statusText.isNullOrBlank()) {
                                                                onAddressQueueResolved("", res.statusText, res.addressLabel, res.emergencyOutage, query)
                                                            }
                                                        }
                                                    }
                                                }
                                                .padding(horizontal = 12.dp, vertical = 8.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = if (isCheckingAddressOnSite) {
                                                    if (lang == "uk") "Перевірка..." else "Checking..."
                                                } else {
                                                    if (lang == "uk") "Перевірити на сайті" else "Verify on website"
                                                },
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color.White
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // 2) "Пошук вручну" / "Manual search" Heading
                        Text(
                            text = AppStrings.queueHelpManualSearchTitle(lang),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            modifier = Modifier.padding(top = 4.dp)
                        )

                        // 3) Numbered instructions 1-4
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            AppStrings.queueHelpSteps(lang).forEach { step ->
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
                                        color = Color.LightGray,
                                        fontSize = 14.sp,
                                        lineHeight = 20.sp,
                                        modifier = Modifier.clickable {
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
                                        color = Color.LightGray,
                                        fontSize = 14.sp,
                                        lineHeight = 20.dp.value.sp
                                    )
                                }
                            }
                        }
                    }

                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color(0x1AFFFFFF)))

                    // Bottom Sticky Confirmation Button
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF141A29))
                            .padding(horizontal = 20.dp, vertical = 12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0xFFFF5E3A))
                                .clickable { showQueueHelpDialog = false }
                                .padding(vertical = 14.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = AppStrings.queueHelpGotIt(lang),
                                color = Color.White,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
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
