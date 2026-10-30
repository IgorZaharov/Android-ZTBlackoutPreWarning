package ua.blackout.prewarning.ui.screens

import android.content.Intent
import android.net.Uri
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
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.blackout.prewarning.ui.AppStrings

@Composable
fun AboutScreen(lang: String = "uk") {
    val context = LocalContext.current

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
                        Text("v1.0.0", fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = Color.White)
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

                // Link 2: Issues & Requests
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

                // Link 3: Original Windows Desktop App
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x14FFFFFF))
                        .clickable {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/IgorZaharov/UABlackoutPreWarning"))
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
                            Text("github.com/IgorZaharov/UABlackoutPreWarning", fontSize = 10.sp, fontFamily = FontFamily.Monospace, color = Color(0x99BAE6FD))
                        }
                    }
                    Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Color(0x99BAE6FD), modifier = Modifier.size(16.dp))
                }
            }
        }

        // 4. Disclaimer Card about ztoe.com.ua
        Box(
            modifier = Modifier
                .fillMaxWidth()
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
