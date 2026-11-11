package ua.blackout.prewarning.ui.screens

import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.blackout.prewarning.BuildConfig
import ua.blackout.prewarning.data.repository.DonationsRepository
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.floatingShadow

@Composable
fun AboutScreen(
    lang: String = "uk",
    onOpenRoulette: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val appContext = remember { context.applicationContext }
    var donationLinks by remember {
        mutableStateOf(DonationsRepository.getCachedDonations(appContext))
    }
    var faviconBitmaps by remember {
        mutableStateOf<Map<String, Bitmap>>(emptyMap())
    }
    var showRouletteDialog by remember {
        mutableStateOf(false)
    }

    val currentBuildVersion = remember {
        val semverRegex = Regex("^[0-9]+\\.[0-9]+.*")
        val rawVersion = try {
            val pInfo = appContext.packageManager.getPackageInfo(appContext.packageName, 0)
            pInfo.versionName?.removePrefix("v")?.trim()
        } catch (_: Exception) {
            null
        }
        val buildCfgVersion = BuildConfig.VERSION_NAME.removePrefix("v").trim()
        val resolved = when {
            !rawVersion.isNullOrBlank() && rawVersion.matches(semverRegex) -> rawVersion
            buildCfgVersion.matches(semverRegex) -> buildCfgVersion
            else -> "1.3.5"
        }
        "v$resolved"
    }

    LaunchedEffect(Unit) {
        val refreshed = withContext(Dispatchers.IO) {
            DonationsRepository.getDonationsWithDailyRefresh(appContext, forceRefresh = true)
        }
        donationLinks = refreshed
        for (item in refreshed) {
            launch(Dispatchers.IO) {
                val bmp = DonationsRepository.fetchFaviconBitmap(appContext, item.url)
                if (bmp != null) {
                    withContext(Dispatchers.Main) {
                        faviconBitmaps = faviconBitmaps + (item.url to bmp)
                    }
                }
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. App Identity Banner
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .floatingShadow(color = Color(0xB3000000), borderRadius = 24.dp, blurRadius = 24.dp, offsetY = 10.dp)
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(20.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(Color(0xFFFF5E3A)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Bolt,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(36.dp)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = AppStrings.aboutTitle(lang),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = AppStrings.aboutSubtitle(lang),
                    fontSize = 12.sp,
                    color = Color(0xB3BAE6FD),
                    modifier = Modifier.padding(horizontal = 12.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0x1AFFFFFF))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(currentBuildVersion, fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = Color.White)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0x33FF5E3A))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text("Jetpack Compose M3", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFFF5E3A))
                    }
                }
            }
        }

        // 2. App Description Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .floatingShadow(color = Color(0xB3000000), borderRadius = 24.dp, blurRadius = 24.dp, offsetY = 10.dp)
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = AppStrings.aboutDescTitle(lang),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xB3BAE6FD)
                )
                Text(
                    text = AppStrings.aboutDescText(lang),
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    color = Color(0xFFE2E8F0)
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .padding(12.dp)
                ) {
                    Text(
                        text = AppStrings.aboutDesktopNotice(lang),
                        fontSize = 11.sp,
                        lineHeight = 16.sp,
                        color = Color(0xB3BAE6FD)
                    )
                }
            }
        }

        // 3. Links Card (Developer, Issues, Desktop App)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .floatingShadow(color = Color(0xB3000000), borderRadius = 24.dp, blurRadius = 24.dp, offsetY = 10.dp)
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = AppStrings.aboutLinksTitle(lang),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xB3BAE6FD)
                )

                // Link 1: GitHub Profile
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/IgorZaharov"))
                            context.startActivity(intent)
                        }
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color.White),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Code, contentDescription = null, tint = Color.Black, modifier = Modifier.size(18.dp))
                        }
                        Column {
                            Text(AppStrings.devProfile(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text("github.com/IgorZaharov", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = Color(0x99BAE6FD))
                        }
                    }
                    Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Color(0x99BAE6FD), modifier = Modifier.size(16.dp))
                }

                // Link 2: Світло в Житомирі на Github
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.ABOUT_GITHUB_README_URL))
                            context.startActivity(intent)
                        }
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0x26FFFFFF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Computer, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                        Column {
                            Text(AppStrings.desktopApp(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text("github.com/IgorZaharov/Android-ZTBlackoutPreWarning/blob/main/README.md", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = Color(0x99BAE6FD))
                        }
                    }
                    Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Color(0x99BAE6FD), modifier = Modifier.size(16.dp))
                }

                // Link 3: Issues & Requests
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning/issues"))
                            context.startActivity(intent)
                        }
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFFFF5E3A)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.BugReport, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                        Column {
                            Text(AppStrings.repoIssues(lang), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            Text("github.com/IgorZaharov/.../issues", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = Color(0x99BAE6FD))
                        }
                    }
                    Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Color(0x99BAE6FD), modifier = Modifier.size(16.dp))
                }
            }
        }

        // 4. Donations / Благодійність і Пожертви Card (loaded from GitHub donations.json once per day)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .floatingShadow(color = Color(0xB3000000), borderRadius = 24.dp, blurRadius = 24.dp, offsetY = 10.dp)
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = AppStrings.aboutDonationsTitle(lang),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xB3BAE6FD)
                )

                donationLinks.forEach { item ->
                    val faviconBmp = faviconBitmaps[item.url]
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0x14FFFFFF))
                            .clickable {
                                try {
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(item.url))
                                    context.startActivity(intent)
                                } catch (_: Exception) {}
                            }
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(Color(0x26FFFFFF)),
                                contentAlignment = Alignment.Center
                            ) {
                                if (faviconBmp != null) {
                                    Image(
                                        bitmap = faviconBmp.asImageBitmap(),
                                        contentDescription = item.title,
                                        contentScale = ContentScale.Fit,
                                        modifier = Modifier
                                            .size(22.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Language,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                            Column {
                                Text(item.title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                                Text(
                                    text = item.url.replaceFirst(Regex("^https?://"), ""),
                                    fontSize = 10.sp,
                                    fontFamily = FontFamily.Monospace,
                                    color = Color(0x99BAE6FD)
                                )
                            }
                        }
                        Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Color(0x99BAE6FD), modifier = Modifier.size(16.dp))
                    }
                }
            }
        }

        // Житомирська Рулетка Button (after Donations block)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .floatingShadow(color = Color(0xB3000000), borderRadius = 24.dp, blurRadius = 24.dp, offsetY = 10.dp)
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .clickable {
                    if (onOpenRoulette != null) {
                        onOpenRoulette()
                    } else {
                        showRouletteDialog = true
                    }
                }
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = AppStrings.rouletteLaunchButton(lang),
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFFDE68A)
            )
        }

        if (showRouletteDialog && onOpenRoulette == null) {
            ZhytomyrRouletteDialog(
                lang = lang,
                onDismiss = { showRouletteDialog = false }
            )
        }

        // 5. Disclaimer Card about ztoe.com.ua
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .floatingShadow(color = Color(0xB3000000), borderRadius = 24.dp, blurRadius = 24.dp, offsetY = 10.dp)
                .shadow(10.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x66000000), spotColor = Color(0x80000000))
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xBF141A29))
                .padding(18.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0x33F59E0B)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Shield, contentDescription = null, tint = Color(0xFFFBBF24), modifier = Modifier.size(18.dp))
                }
                Text(
                    text = AppStrings.disclaimerText(lang),
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    color = Color(0xB3BAE6FD)
                )
            }
        }

        Spacer(modifier = Modifier.height(96.dp))
    }
}
