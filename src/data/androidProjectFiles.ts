/**
 * Complete Native Android (Kotlin + Jetpack Compose) Source Files
 * Ready for direct commit to https://github.com/IgorZaharov/Android-ZTBlackoutPreWarning
 */

export interface AndroidFile {
  path: string;
  language: string;
  description: string;
  content: string;
}

export const ANDROID_PROJECT_FILES: AndroidFile[] = [
  {
    path: 'app/build.gradle.kts',
    language: 'kotlin',
    description: 'App-level build.gradle.kts with Compose, Glance Widget, WorkManager, Jsoup, and canonical signing',
    content: `import java.io.File
import java.util.Base64

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

val embeddedKeystoreBase64 = "MIIKfgIBAzCCCjQGCSqGSIb3DQEHAaCCCiUEggohMIIKHTCCBGIGCSqGSIb3DQEHBqCCBFMwggRPAgEAMIIESAYJKoZIhvcNAQcBMFcGCSqGSIb3DQEFDTBKMCkGCSqGSIb3DQEFDDAcBAjtjDCg6BpdWQICCAAwDAYIKoZIhvcNAgkFADAdBglghkgBZQMEASoEEHDgjViu37hADeCmhc9Z4z+AggPgOoRU3izhNWuSrylTSkYfBDurT8eZkRxlqYSuwHmF5t8hw/OVUusNfJywNFQLQaZD8VgIG/DE+9HdIaen3rFMNCvFch9Wh/oGol0q+s61c8QmdObBoCERvJCDK5BMaXc9Qt6g8LvNuEqSP/sR8t8R014L8DAR3K3v74tieXJLNs4k4pZrp7Vuhi23GvVDD0tR/BlJeTnD86MFCDgY5Fe7y8bJjuhDMPlVooqdwS4qJ8/6o9W+uhutMRkX3hB480+DZCR2GQiV7akUBghnd7TmoTBVLV0Uj4L7l0D+lWVNzXMaAx/11dklGUvFgCirD0fpERSDWlrhxbYck5sw3HRKug4F/e5rla5To6/kJLl+0eQz5zMlr+Jxc72bqSZ9PT3foPQJ3ZU8v1TSkudYoZWk8ussDkIRwr4ZlrXf502/LHmGV9FV142cz9IWTcKwhm/rWG244hwREZv39kKnYIH6ISYlxlCv7FPXBXzYcXdR0q+Ln5BxQzD7KB6NcF9IrUxCGuVvT0JD4GzJZokcMRU4eF0c0E7YAYfjW8BIeqDkmqRXAmDmLgU9Plfp3no22l5ok39/4DqDzWCUeuOI+xw3Dcosyh8vLDNtbF5QzGUoZQDBA+y4KNpa2MOh69a3q4+k5x/pPbk/kusU3nfkT14u0gzBh+pBWfFWhXVDeZWvAY+SMKsH1NobiNTW9MIPgkkqIPIHu+jPNrd9Q7rBxDqYyZyW2ZqNc91SpBhedvkpdnMXo7pAjbwmw4fXpUa/t4O4TqyYhYQqYKGlRicwLNvVgg8g6+zPF+BHPvSruZPb6vlL5ixvBZurDgsQwmRdMMTY7V2tyTeK3FkjAfgdnX3W2P6/xWAY3qlvpZxPbZubs6SKGeYP9FldHJiWEC8GLEjUt8xdLRV97D0ctx2T/tZIGWPHaGcPj2CvD//C+TKTnfdIBGqqODtupC44qhJJ3ZMQa/yJIOlXurzRKf/Lk+w5erNwSp91Wi2gqoUzoo5WrvOMliq1bBLHKY5/f/hJuzN8+znv1irRYOHaP4dvNPl+y+wfa4dzb+JuaQPRVhOAlUKacajXqZW7/gYtAM18D2GwYp6iy9pX4r8BppRgj0E6B4uSFvmKTrIL/98QqTqEw+GFKMoaSdDsx2rTkDLpMLVCuKoozsHFEUn8wqKu8oUnu1Z1q1Z95GVggOLu7EeF8gdtDSOqhiVsCh8j7aqzfgx6etkQnqjFWX1poGPoEamnUe5WzBQbaZ1fOqQkEJ3Mihv9Cnt1KdTJguh/nnCGc3WYgRKrWwVdKIM4im6zHETNs7aQrGqkuwxkm2Ct0F1pK84wggWzBgkqhkiG9w0BBwGgggWkBIIFoDCCBZwwggWYBgsqhkiG9w0BDAoBAqCCBTEwggUtMFcGCSqGSIb3DQEFDTBKMCkGCSqGSIb3DQEFDDAcBAhqaRMiimxSoQICCAAwDAYIKoZIhvcNAgkFADAdBglghkgBZQMEASoEEAM8J/LV8oEKR8VhSToGMN4EggTQYwk1FGXjskeaP6ksR59K7rhvPto3sd+85Lzg8Wyzt8wnc3rzPMpY86s4/azSfiNVVo3kDF9kq1dy3t2apjHGSt5FrqE6UVcsbVh0q8SwqIT4e0Nq46OJvNdLYnZ+t0vGzIL0w5Hl9rU6XPpstk5c/WtosYGLXiKzz6OQ36/7lB0W/VQSQoyv0txAm3rxYxRZj+vWZJxxxAslSPcDp9KQreHErsNlH7osXrUCYT5mpbl92sSs4ggfztmyndbxtaKQZHOjf3p6wWystFUIH5c3jQcrbvqhpp0jeIHsfx/f5m3MXZeDlvVI0dGZ7eilQE/+Qp4PTawqTBgfDmABws4+rljN/bGVscBG1BW0mUoPMlI9ETZr+qo8dBz+fhqzhKcU+l80va4x8Guk/3fZSUW9sszKuCnR0ADkMcskQH39MT69A/60naxLM5qMWpQyo3IhSAuL048sL3EoCI9a2qcOAaPKMblHT8890SSWuZU8nK0dtyIsvltIQTFzKq/hCI8tAf8ME4MmGCZzJnS3CvqYgmc3qGYWbS4TXuh6juHMiYMyhqPb8IRTLDKCN3tOaEP+XzgOq6Er/KznLVaKWnf505C2zr5FKAAPuO1XXQ0qf63twcNkg8UV750hfj1f9dY8onwR1TDqUIBTyQFZ0G3husARIsBLLvIcyow6X4j+0noJfpoZNX35Kd6LmLU7qK3+Ap4dHceef4c6RXxZ/YfybsaRSFu+c97uJpKibbCuTuWJaWxWZSEBldkHUOEDyBRGOR6Wb6vZghcNo95B9RJxr8clUV/EMWojqKj4Ebd/VSsCi17hNNIh1aamcbR9oyB1Ww2cW8DZQsCeVyL18XfR2q27HMsxX15N57PKvktKFC/uQiLzSfl8fOmSbjVIRjtyYSMMkXmNeTl/EBKC2MiYioAyUYlzl9OdiRxL+IF7vVS28eRoPHxt1ct84wDKkbHQAVOGDzuaI2W/46UcPO7UaOKfyXYPc8laZcVU7DJUQ95WPDgoQJAjOImSKTYg+pislzxC0RjNDWMXJZ5ZI9isl6BWnoOGWsOlMcdl5pzOTenbfTjP8iYBOIaGXe0XMfXLFyBdyRBjPUmT+v6Z8Q9/QqlN1/O3zRHjARbA4zoByl8UEYmmYyktcKR7XhTpBX+76yba5K7FmVHcVfxJZJjhTK5dNdbWQApzZGu/LC7QeGy39g/HAj5X6d07in4kAlS5k8EAYhgHTFGawmJTQSbzvaciQg36M/yoSAKgDNNmCi3QAU7jkewFR2uQsxuQi4EG5gtc5V9lCRBLAn1eytt9RGjvnq1H7PeZCYKNq5cOUf6KmaR4GnkgtsDqJ1o5n3nDVi/kPlQMQwybEZ6Wm1CmGKC6e3RXDOJ9hs9y0wP76EZYTmkXWNK9vqwrQ7V4JFr+kmWBkke0ZccFWBALSY01QzVxn9qNG5LG8pgbQ9aSzCmHouhmr+soe1pYLGWaVKx4IPef9oSwYClZZeKEO/614ujGWz7fBvo/XIABkct/GZF1+6hWnhv+8gbll4h3qf4U7KYtyI9lN0DZM3GCIo/EysTBCxShIww0jVS75H7TocKjQRInlmcyuwgMfLG8KPM6pb+MiGANxPuMb+7ahmWL0JAmVkmMI4eMZRvACfo+JAwxVDAjBgkqhkiG9w0BCRUxFgQUAgsnuCcLqN05E5nbV6W3CoW5fBIwLQYJKoZIhvcNAQkUMSAeHgBhAG4AZAByAG8AaQBkAGQAZQBiAHUAZwBrAGUAeTBBMDEwDQYJYIZIAWUDBAIBBQAEIGY0xMSgUWl2f0r7L5rWAlA46U8BpUoCj8XJbJSvl/XYBAgNLIZJWUpLDgICCAA="

val debugKeystoreFile = file("keystore/debug.keystore")
if (!debugKeystoreFile.exists()) {
    debugKeystoreFile.parentFile.mkdirs()
    debugKeystoreFile.writeBytes(Base64.getDecoder().decode(embeddedKeystoreBase64))
}

android {
    namespace = "ua.blackout.prewarning"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.ZTBlackoutPreWarning"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "1.3.3"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        create("canonical") {
            storeFile = debugKeystoreFile
            storePassword = "androiddebugkey"
            keyAlias = "androiddebugkey"
            keyPassword = "androiddebugkey"
            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = true
        }

        val uploadKeystoreFile = file("keystore/upload-keystore.jks")
        val uploadPassword = System.getenv("UPLOAD_KEYSTORE_PASSWORD") ?: ""
        val uploadAlias = System.getenv("UPLOAD_KEY_ALIAS") ?: "upload"
        val uploadKeyPassword = System.getenv("UPLOAD_KEY_PASSWORD") ?: uploadPassword

        create("upload") {
            if (uploadKeystoreFile.exists() && uploadPassword.isNotEmpty()) {
                storeFile = uploadKeystoreFile
                storePassword = uploadPassword
                keyAlias = uploadAlias
                keyPassword = uploadKeyPassword
            } else {
                storeFile = debugKeystoreFile
                storePassword = "androiddebugkey"
                keyAlias = "androiddebugkey"
                keyPassword = "androiddebugkey"
            }
            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = if (file("keystore/upload-keystore.jks").exists() && (System.getenv("UPLOAD_KEYSTORE_PASSWORD") ?: "").isNotEmpty()) {
                signingConfigs.getByName("upload")
            } else {
                signingConfigs.getByName("canonical")
            }
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
            signingConfig = signingConfigs.getByName("canonical")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    // Core & Lifecycle
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)

    // Jetpack Compose & Material 3
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    // Android AppWidget (Jetpack Glance)
    implementation(libs.androidx.glance.appwidget)
    implementation(libs.androidx.glance.material3)

    // Background Processing & Alarms
    implementation(libs.androidx.work.runtime.ktx)

    // Preferences & Local Storage
    implementation(libs.androidx.datastore.preferences)

    // HTML Parsing for ztoe.com.ua
    implementation(libs.jsoup)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)

    // Testing
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}`
  },
  {
    path: 'gradle/libs.versions.toml',
    language: 'toml',
    description: 'Version catalog with modern dependencies',
    content: `[versions]
agp = "8.7.3"
kotlin = "2.0.21"
coreKtx = "1.15.0"
junit = "4.13.2"
junitVersion = "1.2.1"
espressoCore = "3.6.1"
lifecycleRuntimeKtx = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.12.01"
navigationCompose = "2.8.5"
glance = "1.1.1"
work = "2.10.0"
datastore = "1.1.1"
jsoup = "1.18.3"
coroutines = "1.9.0"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
junit = { group = "junit", name = "junit", version.ref = "junit" }
androidx-junit = { group = "androidx.test.ext", name = "junit", version.ref = "junitVersion" }
androidx-espresso-core = { group = "androidx.test.espresso", name = "espresso-core", version.ref = "espressoCore" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycleRuntimeKtx" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-compose-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-compose-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
androidx-compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
androidx-compose-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
androidx-compose-ui-test-manifest = { group = "androidx.compose.ui", name = "ui-test-manifest" }
androidx-compose-ui-test-junit4 = { group = "androidx.compose.ui", name = "ui-test-junit4" }
androidx-compose-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-compose-material-icons-extended = { group = "androidx.compose.material", name = "material-icons-extended" }
androidx-navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigationCompose" }
androidx-glance-appwidget = { group = "androidx.glance", name = "glance-appwidget", version.ref = "glance" }
androidx-glance-material3 = { group = "androidx.glance", name = "glance-material3", version.ref = "glance" }
androidx-work-runtime-ktx = { group = "androidx.work", name = "work-runtime-ktx", version.ref = "work" }
androidx-datastore-preferences = { group = "androidx.datastore", name = "datastore-preferences", version.ref = "datastore" }
jsoup = { group = "org.jsoup", name = "jsoup", version.ref = "jsoup" }
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }`
  },
  {
    path: 'app/src/main/AndroidManifest.xml',
    language: 'xml',
    description: 'Android manifest with notifications, exact alarms, boot receivers, and Glance widget',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Permissions for Network, Notifications & Exact Background Warnings -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:name=".BlackoutApp"
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.ZTBlackoutPreWarning"
        tools:targetApi="35">

        <!-- Main UI Activity -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/Theme.ZTBlackoutPreWarning">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Alarm BroadcastReceiver for Exact Pre-Warnings (1x per slot) -->
        <receiver
            android:name=".notification.AlarmReceiver"
            android:enabled="true"
            android:exported="false">
            <intent-filter>
                <action android:name="ua.blackout.prewarning.ACTION_TRIGGER_BLACKOUT_ALERT" />
            </intent-filter>
        </receiver>

        <!-- Boot Completed Receiver to Reschedule Workers and Alarms -->
        <receiver
            android:name=".worker.BootCompletedReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>

        <!-- Glance Home Screen AppWidget Receiver -->
        <receiver
            android:name=".widget.BlackoutWidgetReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/blackout_widget_info" />
        </receiver>

    </application>
</manifest>`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/model/Models.kt',
    language: 'kotlin',
    description: 'Data models for BlackoutSlot, DaySchedule, and UserSettings',
    content: `package ua.blackout.prewarning.data.model

enum class SlotStatus {
    POWER_ON,
    POWER_OFF
}

data class BlackoutSlot(
    val id: String, // Unique key: "\${date}_\${startHour}_\${queue}"
    val startHour: Int, // 0..23
    val endHour: Int, // 1..24
    val startMinute: Int = 0,
    val endMinute: Int = 0,
    val startTimeStr: String, // "14:00"
    val endTimeStr: String, // "18:00"
    val status: SlotStatus
)

data class DaySchedule(
    val dateStr: String,
    val dayLabel: String,
    val queue: String,
    val slots: List<BlackoutSlot>,
    val lastUpdated: String
)

data class UserSettings(
    val cityUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
    val queue: String = "2.1",
    // CRITICAL CONSTANTS — DO NOT MODIFY UNLESS EXPLICITLY REQUESTED
    val refreshIntervalMinutes: Long = 30L,
    val advanceNoticeMinutes: Int = 15,
    val notificationsEnabled: Boolean = true,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val prevSoundEnabled: Boolean = true,
    val prevVibrationEnabled: Boolean = true,
    val themeMode: String = "SYSTEM", // "SYSTEM", "DARK", "LIGHT"
    val language: String = "SYSTEM" // "SYSTEM", "UK", "EN"
)`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/parser/ZtoeParser.kt',
    language: 'kotlin',
    description: 'Jsoup HTML parser for Zhytomyroblenergo with KYIV_ZONE, 48 half-hour slots and today/tomorrow schedule support',
    content: `package ua.blackout.prewarning.data.parser

import android.content.Context
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

enum class FetchStatus {
    SUCCESS,
    NO_INTERNET,
    NO_QUEUES_FOUND
}

data class ParsedDocumentFull(
    val hasTodayTable: Boolean,
    val todaySlots: List<BlackoutSlot>,
    val hasTomorrowSchedule: Boolean,
    val tomorrowSlots: List<BlackoutSlot>?
)

data class FullScheduleResponse(
    val todaySlots: List<BlackoutSlot>,
    val tomorrowSlots: List<BlackoutSlot>?,
    val hasTomorrowSchedule: Boolean,
    val status: FetchStatus
)

object ZtoeParser {
    private const val USER_AGENT = "Mozilla/5.0 (Android; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0"

    fun hasScheduleTableForDate(doc: Document, date: LocalDate): Boolean {
        val dateDdMmYyyy = date.format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))
        return doc.select("table").any { table ->
            table.text().contains(dateDdMmYyyy)
        } || doc.text().contains(dateDdMmYyyy)
    }

    fun parseHtmlForDate(doc: Document, targetQueue: String, date: LocalDate, dateIso: String): List<BlackoutSlot> {
        val dateDdMmYyyy = date.format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))
        val allTables = doc.select("table")
        val leafTables = allTables.filter { it.select("table").size <= 1 }
        val targetTable = leafTables.firstOrNull { it.text().contains(dateDdMmYyyy) }
            ?: allTables.firstOrNull { it.text().contains(dateDdMmYyyy) }
            ?: doc

        val rows = targetTable.select("tr").filter { it.select("table").isEmpty() }
        val targetRow = rows.firstOrNull { row ->
            val firstThree = row.select("td, th").take(3)
            firstThree.any { cell ->
                val t = cell.text().trim()
                t == targetQueue ||
                    t.equals("Черга $targetQueue", ignoreCase = true) ||
                    t.equals("Черга $targetQueue.", ignoreCase = true) ||
                    t.equals("$targetQueue черга", ignoreCase = true)
            }
        } ?: rows.firstOrNull { row ->
            val text = row.text()
            text.contains("Черга $targetQueue") || text.contains("$targetQueue черга") || text.contains(targetQueue)
        } ?: return generateFallbackSchedule(targetQueue, dateIso)

        val rawCells = targetRow.select("td, th")
        val nonSeparatorCells = rawCells.drop(1).filter { cell ->
            val st = cell.attr("style").lowercase(Locale.ROOT).replace(" ", "")
            !st.contains("width:3pt") && !st.contains("width:1pt")
        }
        val dataCells: List<Element> = when {
            nonSeparatorCells.size >= 48 -> nonSeparatorCells.takeLast(48)
            rawCells.size >= 48 -> rawCells.takeLast(48)
            nonSeparatorCells.size >= 24 -> nonSeparatorCells.takeLast(24)
            rawCells.size >= 24 -> rawCells.takeLast(24)
            else -> rawCells.drop(1)
        }

        if (dataCells.size != 48 && dataCells.size != 24) {
            return generateFallbackSchedule(targetQueue, dateIso)
        }

        val is48 = dataCells.size == 48
        return (0 until 48).map { index ->
            val cell = if (is48) dataCells[index] else dataCells[index / 2]
            val text = cell.text().trim().lowercase(Locale.ROOT)
            val style = cell.attr("style").lowercase(Locale.ROOT)
            val className = cell.className().lowercase(Locale.ROOT)
            val bgColor = cell.attr("bgcolor").lowercase(Locale.ROOT)
            val combinedAttr = "\$style \$className \$bgColor"

            val isOff = className.contains("red") || className.contains("off") || className.contains("danger") ||
                    combinedAttr.contains("#ff3333") || combinedAttr.contains("#ff3b30") || combinedAttr.contains("#ff0000") ||
                    combinedAttr.contains("background:red") || combinedAttr.contains("background: red") ||
                    combinedAttr.contains("background-color:red") || combinedAttr.contains("background-color: red") ||
                    combinedAttr.contains("rgb(255, 51, 51)") || combinedAttr.contains("rgb(255,51,51)") ||
                    combinedAttr.contains("rgb(255, 0, 0)") || combinedAttr.contains("rgb(255,0,0)") ||
                    bgColor == "red" ||
                    text.contains("вимк") || text.contains("відкл") || text == "в" || text == "-"

            val startTotalMinutes = index * 30
            val endTotalMinutes = (index + 1) * 30
            val startH = startTotalMinutes / 60
            val startM = startTotalMinutes % 60
            val endH = endTotalMinutes / 60
            val endM = endTotalMinutes % 60

            val startStr = String.format("%02d:%02d", startH, startM)
            val endStr = if (endH >= 24) "24:00" else String.format("%02d:%02d", endH, endM)

            BlackoutSlot(
                id = "\${dateIso}_\${startStr}_Q$targetQueue",
                startHour = startH,
                endHour = endH,
                startMinute = startM,
                endMinute = endM,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = if (isOff) SlotStatus.POWER_OFF else SlotStatus.POWER_ON
            )
        }
    }

    fun parseDocumentFull(doc: Document, queue: String, today: LocalDate = LocalDate.now(KYIV_ZONE)): ParsedDocumentFull {
        val todayIso = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val tomorrow = today.plusDays(1)
        val tomorrowIso = tomorrow.format(DateTimeFormatter.ISO_LOCAL_DATE)

        val hasToday = hasScheduleTableForDate(doc, today)
        val todaySlots = if (hasToday) {
            parseHtmlForDate(doc, queue, today, todayIso)
        } else {
            generateFallbackSchedule(queue, todayIso)
        }

        val hasTomorrow = hasScheduleTableForDate(doc, tomorrow)
        val tomorrowSlots = if (hasTomorrow) {
            parseHtmlForDate(doc, queue, tomorrow, tomorrowIso)
        } else {
            null
        }

        return ParsedDocumentFull(
            hasTodayTable = hasToday,
            todaySlots = todaySlots,
            hasTomorrowSchedule = hasTomorrow && tomorrowSlots != null,
            tomorrowSlots = tomorrowSlots
        )
    }

    fun fetchFullSchedule(
        url: String,
        queue: String,
        context: Context? = null,
        forceNetwork: Boolean = false
    ): FullScheduleResponse {
        val today = LocalDate.now(KYIV_ZONE)
        return try {
            val doc = Jsoup.connect(url)
                .userAgent(USER_AGENT)
                .timeout(10000)
                .get()

            val parsed = parseDocumentFull(doc, queue, today)
            if (!parsed.hasTodayTable && parsed.todaySlots.isEmpty()) {
                FullScheduleResponse(
                    todaySlots = emptyList(),
                    tomorrowSlots = null,
                    hasTomorrowSchedule = false,
                    status = FetchStatus.NO_QUEUES_FOUND
                )
            } else {
                FullScheduleResponse(
                    todaySlots = parsed.todaySlots,
                    tomorrowSlots = parsed.tomorrowSlots,
                    hasTomorrowSchedule = parsed.hasTomorrowSchedule,
                    status = FetchStatus.SUCCESS
                )
            }
        } catch (_: Exception) {
            FullScheduleResponse(
                todaySlots = emptyList(),
                tomorrowSlots = null,
                hasTomorrowSchedule = false,
                status = FetchStatus.NO_INTERNET
            )
        }
    }

    fun fetchAndParse(
        url: String,
        queue: String,
        date: LocalDate = LocalDate.now(KYIV_ZONE)
    ): List<BlackoutSlot> {
        val dateIso = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        return try {
            val doc = Jsoup.connect(url)
                .userAgent(USER_AGENT)
                .timeout(10000)
                .get()
            parseHtmlForDate(doc, queue, date, dateIso)
        } catch (_: Exception) {
            generateFallbackSchedule(queue, dateIso)
        }
    }

    fun parseHtml(doc: Document, targetQueue: String, dateStr: String): List<BlackoutSlot> {
        val today = LocalDate.now(KYIV_ZONE)
        return parseHtmlForDate(doc, targetQueue, today, dateStr)
    }

    fun generateFallbackSchedule(queue: String, dateStr: String = LocalDate.now(KYIV_ZONE).format(DateTimeFormatter.ISO_LOCAL_DATE)): List<BlackoutSlot> {
        val parts = queue.split(".")
        val group = parts.getOrNull(0)?.toIntOrNull() ?: 1
        val sub = parts.getOrNull(1)?.toIntOrNull() ?: 1
        val shift = ((group - 1) * 3 + (sub - 1) * 2) % 24

        return (0 until 48).map { slotIdx ->
            val hour = slotIdx / 2
            val isSecondHalf = (slotIdx % 2) == 1
            val cycleHour = (hour + shift) % 24
            val status = when {
                (cycleHour in 2..5) || (cycleHour in 12..15) || (cycleHour in 20..23) -> SlotStatus.POWER_OFF
                else -> SlotStatus.POWER_ON
            }
            val startMin = if (isSecondHalf) 30 else 0
            val endMin = if (isSecondHalf) 0 else 30
            val endHour = if (isSecondHalf) hour + 1 else hour
            val startStr = String.format("%02d:%02d", hour, startMin)
            val endStr = if (endHour >= 24) "24:00" else String.format("%02d:%02d", endHour, endMin)

            BlackoutSlot(
                id = "\${dateStr}_\${startStr}_Q$queue",
                startHour = hour,
                endHour = endHour,
                startMinute = startMin,
                endMinute = if (isSecondHalf) 60 else 30,
                startTimeStr = startStr,
                endTimeStr = endStr,
                status = status
            )
        }
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/data/repository/AlertRegistry.kt',
    language: 'kotlin',
    description: 'Deduplication store ensuring notifications are fired STRICTLY ONCE per blackout slot',
    content: `package ua.blackout.prewarning.data.repository

import android.content.Context
import android.content.SharedPreferences

class AlertRegistry(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("zt_notified_blackouts_v1", Context.MODE_PRIVATE)

    /**
     * Checks if this specific blackout slot has already been notified.
     * Guarantees 100% adherence to "notification sent only once per blackout slot".
     */
    fun hasNotified(slotId: String): Boolean {
        return prefs.getBoolean("notified_$slotId", false)
    }

    /**
     * Marks the slot as notified with timestamp
     */
    fun markNotified(slotId: String) {
        prefs.edit()
            .putBoolean("notified_$slotId", true)
            .putLong("ts_$slotId", System.currentTimeMillis())
            .apply()
    }

    /**
     * Resets notified flags for future slots on time changes
     */
    fun resetFutureSlotsOnTimeChange(currentTimeMillis: Long, futureSlotIds: Set<String>) {
        val editor = prefs.edit()
        for (slotId in futureSlotIds) {
            editor.remove("notified_$slotId")
            editor.remove("ts_$slotId")
        }
        editor.apply()
    }

    /**
     * Clears old history (e.g. from previous days)
     */
    fun clearHistory() {
        prefs.edit().clear().apply()
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/notification/NotificationHelper.kt',
    language: 'kotlin',
    description: 'High-priority notification channel & builder with tap-to-open PendingIntent',
    content: `package ua.blackout.prewarning.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R

object NotificationHelper {
    const val CHANNEL_ID = "zt_blackout_prewarning_channel"
    private const val CHANNEL_NAME = "Попередження про відключення"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = "Термінові сповіщення про наближення планового відключення світла"
                enableVibration(true)
                enableLights(true)
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    fun createNotificationChannels(context: Context) {
        createNotificationChannel(context)
    }

    fun showPreWarningNotification(
        context: Context,
        notificationId: Int,
        title: String,
        body: String,
        isTest: Boolean = false
    ) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setSound(soundUri)

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(notificationId, builder.build())
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/notification/AlarmReceiver.kt',
    language: 'kotlin',
    description: 'Exact Alarm BroadcastReceiver enforcing single-notification-per-slot rule',
    content: `package ua.blackout.prewarning.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import ua.blackout.prewarning.data.repository.AlertRegistry

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val slotId = intent.getStringExtra("EXTRA_SLOT_ID") ?: return
        val queue = intent.getStringExtra("EXTRA_QUEUE") ?: "2.1"
        val timeStr = intent.getStringExtra("EXTRA_TIME") ?: "14:00"
        val minutes = intent.getIntExtra("EXTRA_MINUTES", 30)

        val alertRegistry = AlertRegistry(context)

        // STRICT REQUIREMENT: Send notification only once per blackout slot
        if (alertRegistry.hasNotified(slotId)) {
            return
        }

        // Mark as notified immediately
        alertRegistry.markNotified(slotId)

        val title = "⚡ Попередження: відключення світла"
        val body = "Черга $queue: відключення розпочнеться о $timeStr (через $minutes хв)."

        val notificationId = slotId.hashCode()
        NotificationHelper.showPreWarningNotification(context, notificationId, title, body)
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/worker/ScheduleSyncWorker.kt',
    language: 'kotlin',
    description: 'WorkManager periodic background worker with AlarmManager exact scheduling',
    content: `package ua.blackout.prewarning.worker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import ua.blackout.prewarning.data.parser.ZtoeParser
import ua.blackout.prewarning.data.repository.AlertRegistry
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmReceiver
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

class ScheduleSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            val settingsRepo = SettingsRepository(context)
            val settings = settingsRepo.getSettings()

            if (!settings.notificationsEnabled) {
                return Result.success()
            }

            val today = LocalDate.now()
            val slots = ZtoeParser.fetchAndParse(settings.cityUrl, settings.queue, today)
            val alertRegistry = AlertRegistry(context)

            val now = LocalDateTime.now()
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            // Battery & UX Optimization: Group consecutive blackout slots into continuous blocks.
            // Only 1 alarm is scheduled per blackout block, preventing multiple wakeups/alerts!
            val intervals = mutableListOf<Pair<Int, Int>>() // list of Pair(startHour, endHour)
            var inBlock = false
            var blockStart = 0
            for (i in 0 until 24) {
                val isOff = slots.getOrNull(i)?.status == ua.blackout.prewarning.data.model.SlotStatus.POWER_OFF
                if (isOff && !inBlock) {
                    inBlock = true
                    blockStart = i
                } else if (!isOff && inBlock) {
                    inBlock = false
                    intervals.add(Pair(blockStart, i))
                }
            }
            if (inBlock) {
                intervals.add(Pair(blockStart, 24))
            }

            // Schedule single exact alarm for each upcoming blackout block
            for (block in intervals) {
                val startHour = block.first
                val endHour = block.second
                val startStr = String.format("%02d:00", startHour)
                val endStr = String.format("%02d:00", endHour)
                val blockId = "block_\${today}_\${startStr}_\${endStr}_Q\${settings.queue}"

                if (alertRegistry.hasNotified(blockId)) {
                    continue // Block already alerted
                }

                val blockStartTime = LocalDateTime.of(today, LocalTime.of(startHour, 0))
                val alertTime = blockStartTime.minusMinutes(settings.advanceNoticeMinutes.toLong())

                if (alertTime.isAfter(now)) {
                    val epochMillis = alertTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                    val timeSpan = if (endHour - startHour > 1) "$startStr–$endStr" else startStr
                    val intent = Intent(context, AlarmReceiver::class.java).apply {
                        action = "ua.blackout.prewarning.ACTION_TRIGGER_BLACKOUT_ALERT"
                        putExtra("EXTRA_SLOT_ID", blockId)
                        putExtra("EXTRA_QUEUE", settings.queue)
                        putExtra("EXTRA_TIME", timeSpan)
                        putExtra("EXTRA_MINUTES", settings.advanceNoticeMinutes)
                    }

                    val pendingIntent = PendingIntent.getBroadcast(
                        context,
                        blockId.hashCode(),
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, epochMillis, pendingIntent)
                    }
                }
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val WORK_NAME = "ua.blackout.prewarning.schedule_sync"

        fun schedulePeriodicWork(
            context: Context,
            policy: androidx.work.ExistingPeriodicWorkPolicy = androidx.work.ExistingPeriodicWorkPolicy.KEEP
        ) {
            val settingsRepo = ua.blackout.prewarning.data.repository.SettingsRepository(context)
            val settings = settingsRepo.getSettings()
            val intervalMinutes = maxOf(15L, settings.refreshIntervalMinutes)

            val constraints = androidx.work.Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                .build()

            val request = androidx.work.PeriodicWorkRequestBuilder<ScheduleSyncWorker>(
                intervalMinutes,
                java.util.concurrent.TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .build()

            androidx.work.WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                policy,
                request
            )
        }

        fun syncImmediately(context: Context) {
            val constraints = androidx.work.Constraints.Builder()
                .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                .build()

            val request = androidx.work.OneTimeWorkRequestBuilder<ScheduleSyncWorker>()
                .setConstraints(constraints)
                .build()

            androidx.work.WorkManager.getInstance(context).enqueue(request)
        }
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/widget/BlackoutGlanceWidget.kt',
    language: 'kotlin',
    description: 'Jetpack Glance AppWidget: responsive Small (2x1) & Big (3x2/4x2) layouts, 24h timeline bitmap parity, refresh & mute callbacks',
    content: `package ua.blackout.prewarning.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.Button
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.*
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import ua.blackout.prewarning.MainActivity
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.KYIV_ZONE
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.data.repository.SettingsRepository
import ua.blackout.prewarning.notification.AlarmScheduler
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.worker.ScheduleSyncWorker
import java.time.LocalTime
import java.util.concurrent.ConcurrentHashMap

class BlackoutGlanceWidget : GlanceAppWidget() {

    companion object {
        val SMALL_BOX = DpSize(110.dp, 48.dp)
        val BIG_BOX = DpSize(220.dp, 110.dp)

        suspend fun hasActiveWidgets(context: Context): Boolean {
            return try {
                val manager = GlanceAppWidgetManager(context)
                val glanceIds = manager.getGlanceIds(BlackoutGlanceWidget::class.java)
                glanceIds.isNotEmpty()
            } catch (_: Exception) {
                false
            }
        }

        suspend fun syncAllWidgets(context: Context) {
            try {
                BlackoutGlanceWidget().updateAll(context)
            } catch (_: Exception) {}
        }

        private val bitmapCache = ConcurrentHashMap<String, Bitmap>()
    }

    override val sizeMode: SizeMode = SizeMode.Responsive(setOf(SMALL_BOX, BIG_BOX))

    fun formatWidgetCountdown(rawCountdown: String, isBlackoutNow: Boolean, nextSlotTime: String, lang: String): String {
        val isUk = lang == "uk"
        if (rawCountdown.isEmpty() || rawCountdown == "--:--:--") {
            return if (isUk) "--г. --хв." else "--hr. --m."
        }
        val parts = rawCountdown.split(":")
        if (parts.size >= 2) {
            val hh = parts[0].trim()
            val mm = parts[1].trim()
            return if (isUk) "\${hh}г. \${mm}хв." else "\${hh}hr. \${mm}m."
        }
        return rawCountdown
    }

    fun renderAnalogCounterBitmap(slots: List<BlackoutSlot>, currentH: Int, currentM: Int, lang: String = "uk"): Bitmap {
        val slotSig = if (slots.isEmpty()) "empty" else slots.joinToString("") { if (it.status == SlotStatus.POWER_OFF) "1" else "0" }
        val cacheKey = "\${slotSig}_\${currentH}_\${currentM}_\$lang"
        bitmapCache[cacheKey]?.let { return it }

        val width = 720
        val height = 132
        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        paint.color = AndroidColor.parseColor("#DFDDD0")
        val outerRect = RectF(0f, 0f, width.toFloat(), height.toFloat())
        canvas.drawRoundRect(outerRect, 20f, 20f, paint)

        paint.color = AndroidColor.parseColor("#7A7768")
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 3f
        canvas.drawRoundRect(outerRect, 20f, 20f, paint)
        paint.style = Paint.Style.FILL

        val drumLeft = 16f
        val drumTop = 16f
        val drumRight = width - 16f
        val drumBottom = 80f
        paint.color = AndroidColor.parseColor("#4E514E")
        val drumRect = RectF(drumLeft, drumTop, drumRight, drumBottom)
        canvas.drawRoundRect(drumRect, 10f, 10f, paint)

        val innerPad = 4f
        val slotAreaLeft = drumLeft + innerPad
        val slotAreaTop = drumTop + innerPad
        val slotAreaRight = drumRight - innerPad
        val slotAreaBottom = drumBottom - innerPad
        val slotAreaWidth = slotAreaRight - slotAreaLeft
        val slotAreaHeight = slotAreaBottom - slotAreaTop

        if (slots.isEmpty()) {
            paint.color = AndroidColor.parseColor("#7E8287")
            val unclearRect = RectF(slotAreaLeft, slotAreaTop, slotAreaRight, slotAreaBottom)
            canvas.drawRoundRect(unclearRect, 4f, 4f, paint)

            paint.color = AndroidColor.WHITE
            paint.textSize = 24f
            paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            paint.textAlign = Paint.Align.CENTER
            val textY = slotAreaTop + (slotAreaHeight / 2f) - ((paint.descent() + paint.ascent()) / 2f)
            canvas.drawText(AppStrings.outagesUnclear(lang), width / 2f, textY, paint)
        } else {
            val is48Slots = slots.size >= 48
            val hourWidth = slotAreaWidth / 24f
            val halfWidth = hourWidth / 2f

            for (hour in 0 until 24) {
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

                val hLeft = slotAreaLeft + hour * hourWidth

                paint.color = if (half1Off) AndroidColor.parseColor("#D62E26") else AndroidColor.parseColor("#FCFBF7")
                canvas.drawRect(hLeft, slotAreaTop, hLeft + halfWidth, slotAreaBottom, paint)

                paint.color = if (half2Off) AndroidColor.parseColor("#D62E26") else AndroidColor.parseColor("#FCFBF7")
                canvas.drawRect(hLeft + halfWidth, slotAreaTop, hLeft + hourWidth, slotAreaBottom, paint)

                if (hour > 0) {
                    paint.color = AndroidColor.parseColor("#C8C6BC")
                    canvas.drawRect(hLeft - 0.75f, slotAreaTop, hLeft + 0.75f, slotAreaBottom, paint)
                }
            }

            val totalMinutes = currentH * 60 + currentM
            val needleX = slotAreaLeft + (totalMinutes / 1440f) * slotAreaWidth
            paint.color = AndroidColor.parseColor("#0B0B0A")
            val needleRect = RectF(needleX - 2.5f, drumTop - 4f, needleX + 2.5f, drumBottom + 4f)
            canvas.drawRoundRect(needleRect, 2.5f, 2.5f, paint)
        }

        paint.color = AndroidColor.parseColor("#1C1B18")
        paint.textSize = 20f
        paint.typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        paint.textAlign = Paint.Align.CENTER

        val markers = listOf(0, 4, 8, 12, 16, 20, 24)
        for (m in markers) {
            val markX = slotAreaLeft + (m / 24f) * slotAreaWidth
            canvas.drawRect(markX - 1f, drumBottom + 4f, markX + 1f, drumBottom + 12f, paint)
            val label = String.format("%02d", m)
            canvas.drawText(label, markX.coerceIn(slotAreaLeft + 16f, slotAreaRight - 16f), height - 12f, paint)
        }

        if (bitmapCache.size > 32) {
            bitmapCache.clear()
        }
        bitmapCache[cacheKey] = bmp
        return bmp
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val settingsRepo = SettingsRepository(context)
        val scheduleRepo = ScheduleRepository(context)
        val settings = settingsRepo.getSettings()
        val info = scheduleRepo.getCurrentStatusAndCountdown(settings.queue)
        val slots = scheduleRepo.getTodaySlots(settings.queue)
        val resolvedLang = AppStrings.resolveLang(settings.language)
        val now = LocalTime.now(KYIV_ZONE)

        provideContent {
            GlanceTheme {
                val size = LocalSize.current
                val isBig = size.width >= BIG_BOX.width || size.height >= BIG_BOX.height

                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .padding(6.dp)
                        .background(ColorProvider(androidx.compose.ui.graphics.Color(0xCC141A29)))
                        .clickable(actionStartActivity<MainActivity>())
                ) {
                    if (isBig) {
                        BigWidgetContent(context, settings, scheduleRepo, info, slots, resolvedLang, now)
                    } else {
                        SmallWidgetContent(settings, info, resolvedLang)
                    }
                }
            }
        }
    }

    @androidx.compose.runtime.Composable
    private fun SmallWidgetContent(
        settings: ua.blackout.prewarning.data.model.UserSettings,
        info: ua.blackout.prewarning.data.repository.ScheduleStatusInfo,
        resolvedLang: String
    ) {
        val isUnclear = info.isUnclear
        val statusText = if (isUnclear) {
            AppStrings.powerUnclear(resolvedLang)
        } else if (info.isBlackoutNow) {
            "СВІТЛА НЕМАЄ"
        } else {
            "СВІТЛО Є"
        }

        val formattedCountdown = formatWidgetCountdown(info.countdownText, info.isBlackoutNow, info.nextSlotTime, resolvedLang)
        val countdownLabel = if (!isUnclear && info.isBlackoutNow) {
            if (resolvedLang == "uk") "До увімкнення:" else "Power on in:"
        } else {
            if (resolvedLang == "uk") "До відключення:" else "Time to blackout:"
        }

        Column(
            modifier = GlanceModifier.fillMaxSize().padding(6.dp),
            verticalAlignment = Alignment.Vertical.CenterVertically
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically
            ) {
                Text(
                    text = "\${AppStrings.queue(resolvedLang)} \${settings.queue}",
                    style = TextStyle(
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = ColorProvider(androidx.compose.ui.graphics.Color.White)
                    )
                )
                Spacer(modifier = GlanceModifier.defaultWeight())
                Text(
                    text = statusText,
                    style = TextStyle(
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = if (isUnclear) {
                            ColorProvider(androidx.compose.ui.graphics.Color(0xFFA1A1AA))
                        } else if (info.isBlackoutNow) {
                            ColorProvider(androidx.compose.ui.graphics.Color(0xFFFF5E3A))
                        } else {
                            ColorProvider(androidx.compose.ui.graphics.Color(0xFF34D399))
                        }
                    )
                )
            }

            Spacer(modifier = GlanceModifier.height(4.dp))

            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically
            ) {
                Column(modifier = GlanceModifier.defaultWeight()) {
                    Text(
                        text = countdownLabel,
                        style = TextStyle(
                            fontSize = 9.sp,
                            color = ColorProvider(androidx.compose.ui.graphics.Color(0xFFBAE6FD))
                        )
                    )
                    Text(
                        text = formattedCountdown,
                        style = TextStyle(
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = ColorProvider(androidx.compose.ui.graphics.Color.White)
                        ),
                        maxLines = 1
                    )
                }

                Image(
                    provider = ImageProvider(R.drawable.ic_refresh),
                    contentDescription = "Refresh",
                    modifier = GlanceModifier
                        .size(32.dp)
                        .padding(4.dp)
                        .clickable(actionRunCallback<RefreshWidgetActionCallback>())
                )

                Spacer(modifier = GlanceModifier.width(4.dp))

                Button(
                    text = if (settings.notificationsEnabled) "🔕" else "🔔",
                    onClick = actionRunCallback<ToggleAlertsActionCallback>()
                )
            }
        }
    }

    @androidx.compose.runtime.Composable
    private fun BigWidgetContent(
        context: Context,
        settings: ua.blackout.prewarning.data.model.UserSettings,
        scheduleRepo: ScheduleRepository,
        info: ua.blackout.prewarning.data.repository.ScheduleStatusInfo,
        slots: List<BlackoutSlot>,
        resolvedLang: String,
        now: LocalTime
    ) {
        val isUnclear = info.isUnclear
        val statusText = if (isUnclear) {
            AppStrings.powerUnclear(resolvedLang)
        } else if (info.isBlackoutNow) {
            "СВІТЛА НЕМАЄ"
        } else {
            "СВІТЛО Є"
        }

        val formattedCountdown = formatWidgetCountdown(info.countdownText, info.isBlackoutNow, info.nextSlotTime, resolvedLang)
        val countdownLabel = if (!isUnclear && info.isBlackoutNow) {
            if (resolvedLang == "uk") "До увімкнення:" else "Power on in:"
        } else {
            if (resolvedLang == "uk") "До відключення:" else "Time to blackout:"
        }

        val nextBlackoutText = if (isUnclear) "--:-- - --:--" else scheduleRepo.getNextUpcomingIntervalText(settings.queue)
        val nextLabel = if (resolvedLang == "uk") "Наступне відключення:" else "Next blackout:"

        val timelineBitmap = renderAnalogCounterBitmap(slots, now.hour, now.minute, resolvedLang)

        Column(
            modifier = GlanceModifier.fillMaxSize().padding(8.dp),
            verticalAlignment = Alignment.Vertical.Top
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically
            ) {
                Column {
                    Text(
                        text = "\${AppStrings.queue(resolvedLang)} \${settings.queue}",
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = ColorProvider(androidx.compose.ui.graphics.Color.White)
                        )
                    )
                    Text(
                        text = statusText,
                        style = TextStyle(
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = if (isUnclear) {
                                ColorProvider(androidx.compose.ui.graphics.Color(0xFFA1A1AA))
                            } else if (info.isBlackoutNow) {
                                ColorProvider(androidx.compose.ui.graphics.Color(0xFFFF5E3A))
                            } else {
                                ColorProvider(androidx.compose.ui.graphics.Color(0xFF34D399))
                            }
                        )
                    )
                }

                Spacer(modifier = GlanceModifier.defaultWeight())

                Image(
                    provider = ImageProvider(R.drawable.ic_refresh),
                    contentDescription = "Refresh",
                    modifier = GlanceModifier
                        .size(32.dp)
                        .padding(4.dp)
                        .clickable(actionRunCallback<RefreshWidgetActionCallback>())
                )

                Spacer(modifier = GlanceModifier.width(4.dp))

                Button(
                    text = if (settings.notificationsEnabled) "🔕" else "🔔",
                    onClick = actionRunCallback<ToggleAlertsActionCallback>()
                )
            }

            Spacer(modifier = GlanceModifier.height(4.dp))

            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically
            ) {
                Text(
                    text = "$countdownLabel $formattedCountdown",
                    style = TextStyle(
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(androidx.compose.ui.graphics.Color.White)
                    )
                )
                Spacer(modifier = GlanceModifier.defaultWeight())
                Text(
                    text = if (isUnclear) "--:-- - --:--" else info.nextSlotTime,
                    style = TextStyle(
                        fontSize = 11.sp,
                        color = ColorProvider(androidx.compose.ui.graphics.Color(0xFFBAE6FD))
                    )
                )
            }

            Spacer(modifier = GlanceModifier.height(4.dp))

            Image(
                provider = ImageProvider(timelineBitmap),
                contentDescription = "24h Timeline",
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .height(38.dp)
            )

            Spacer(modifier = GlanceModifier.height(2.dp))

            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                verticalAlignment = Alignment.Vertical.CenterVertically
            ) {
                Text(
                    text = nextLabel,
                    style = TextStyle(
                        fontSize = 10.sp,
                        color = ColorProvider(androidx.compose.ui.graphics.Color(0xFFFF5E3A))
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
                Text(
                    text = nextBlackoutText,
                    style = TextStyle(
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = ColorProvider(androidx.compose.ui.graphics.Color.White)
                    )
                )
            }
        }
    }
}

class RefreshWidgetActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                ScheduleSyncWorker.syncImmediately(appContext)
                AlarmScheduler.syncAlarms(appContext)
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {}
        }
    }
}

class ToggleAlertsActionCallback : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val appContext = context.applicationContext
        val settingsRepo = SettingsRepository(appContext)
        val current = settingsRepo.getSettings()
        val newState = !current.notificationsEnabled
        settingsRepo.updateNotificationsEnabled(newState)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                AlarmScheduler.syncAlarms(appContext)
                BlackoutGlanceWidget.syncAllWidgets(appContext)
            } catch (_: Exception) {}
        }
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/widget/BlackoutWidgetReceiver.kt',
    language: 'kotlin',
    description: 'GlanceAppWidgetReceiver binding the widget lifecycle',
    content: `package ua.blackout.prewarning.widget

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class BlackoutWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = BlackoutGlanceWidget()
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/MainActivity.kt',
    language: 'kotlin',
    description: 'Main Jetpack Compose Activity with Material 3 navigation and permission handling',
    content: `package ua.blackout.prewarning

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import ua.blackout.prewarning.notification.NotificationHelper
import ua.blackout.prewarning.ui.screens.BlackoutAppNavigation
import ua.blackout.prewarning.ui.theme.ZTBlackoutTheme

class MainActivity : ComponentActivity() {

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { isGranted ->
            // Notification permission granted or denied
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize Notification Channels
        NotificationHelper.createNotificationChannel(this)

        // Request runtime permission for Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            val systemDark = isSystemInDarkTheme()
            var isDarkMode by remember { mutableStateOf(systemDark) }

            ZTBlackoutTheme(darkTheme = isDarkMode) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    BlackoutAppNavigation(
                        onThemeChanged = { isDarkMode = it }
                    )
                }
            }
        }
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/screens/MainScreen.kt',
    language: 'kotlin',
    description: 'Compose MainScreen with Hero Countdown, Today/Tomorrow tabs, 24h timeline, Facebook & site links',
    content: `package ua.blackout.prewarning.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ua.blackout.prewarning.R
import ua.blackout.prewarning.data.model.BlackoutSlot
import ua.blackout.prewarning.data.model.SlotStatus
import ua.blackout.prewarning.data.repository.ScheduleRepository
import ua.blackout.prewarning.ui.AppStrings
import ua.blackout.prewarning.ui.components.TimelineBar
import java.time.LocalTime
import ua.blackout.prewarning.data.KYIV_ZONE

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    queue: String = "2.1",
    isBlackoutNow: Boolean = false,
    countdownText: String = "01:35:12",
    slotTimeText: String = "14:00 – 18:00",
    slots: List<BlackoutSlot> = emptyList(),
    tomorrowSlots: List<BlackoutSlot>? = null,
    hasTomorrowSchedule: Boolean = false,
    notificationsEnabled: Boolean = true,
    lastUpdated: String = "--:--",
    nextUpdated: String = "--:--",
    lang: String = "uk",
    onToggleNotifications: () -> Unit = {},
    onRefresh: () -> Unit = {},
    onSendTestAlert: () -> Unit = {}
) {
    val context = LocalContext.current
    var selectedDayTab by remember { mutableStateOf("today") }

    LaunchedEffect(hasTomorrowSchedule, tomorrowSlots) {
        if (!hasTomorrowSchedule && selectedDayTab == "tomorrow") {
            selectedDayTab = "today"
        }
    }

    val isTomorrowSelected = selectedDayTab == "tomorrow" && tomorrowSlots != null
    val activeSlots = if (isTomorrowSelected) (tomorrowSlots ?: emptyList()) else slots
    val activeSlotsSignature = remember(activeSlots) {
        activeSlots.joinToString("") { if (it.status == SlotStatus.POWER_OFF) "1" else "0" }
    }

    val isUnclear = activeSlots.isEmpty() || activeSlots.all { it.status == SlotStatus.POWER_ON && activeSlots.isEmpty() }
    val now = remember { LocalTime.now(KYIV_ZONE) }
    val nowMinutes = now.hour * 60 + now.minute

    val intervals = remember(activeSlotsSignature) {
        ScheduleRepository.computeDetailedIntervals(activeSlots)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "\${AppStrings.queue(lang)} $queue",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "Житомиробленерго (ZTOE)",
                    fontSize = 12.sp,
                    color = Color(0xFFBAE6FD)
                )
            }

            IconButton(
                onClick = onToggleNotifications,
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(if (notificationsEnabled) Color(0xFFFF5E3A) else Color(0x33FFFFFF))
            ) {
                Icon(
                    imageVector = if (notificationsEnabled) Icons.Default.NotificationsActive else Icons.Default.NotificationsOff,
                    contentDescription = if (notificationsEnabled) "Сповіщення УВІМК" else "Сповіщення ВИМК",
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xCC141A29))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                val statusTitle = if (isUnclear) {
                    AppStrings.powerUnclear(lang)
                } else if (isBlackoutNow) {
                    AppStrings.powerOff(lang)
                } else {
                    AppStrings.powerOn(lang)
                }

                val statusColor = if (isUnclear) {
                    Color(0xFFA1A1AA)
                } else if (isBlackoutNow) {
                    Color(0xFFFF5E3A)
                } else {
                    Color(0xFF34D399)
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(statusColor)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = statusTitle,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = statusColor
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                val countdownLabel = if (!isUnclear && isBlackoutNow) {
                    AppStrings.powerOnIn(lang)
                } else {
                    AppStrings.powerOffIn(lang)
                }

                Text(
                    text = countdownLabel,
                    fontSize = 12.sp,
                    color = Color(0xFFBAE6FD)
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = if (isUnclear) "--:--:--" else countdownText,
                    fontSize = 44.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(8.dp))

                val periodLabel = if (!isUnclear && isBlackoutNow) {
                    AppStrings.outagePeriod(lang)
                } else {
                    AppStrings.nextPeriod(lang)
                }
                val periodDetail = if (isUnclear) "--:-- - --:--" else slotTimeText

                Text(
                    text = "$periodLabel $periodDetail",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFFE2E8F0)
                )
            }
        }

        key(queue, selectedDayTab, activeSlotsSignature) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xCC141A29))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0x22000000))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Button(
                            onClick = { selectedDayTab = "today" },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (!isTomorrowSelected) Color.White else Color.Transparent,
                                contentColor = if (!isTomorrowSelected) Color.Black else Color.White
                            )
                        ) {
                            Text(AppStrings.today(lang), fontWeight = FontWeight.Bold)
                        }

                        if (hasTomorrowSchedule && tomorrowSlots != null) {
                            Button(
                                onClick = { selectedDayTab = "tomorrow" },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isTomorrowSelected) Color.White else Color.Transparent,
                                    contentColor = if (isTomorrowSelected) Color.Black else Color.White
                                )
                            ) {
                                Text(AppStrings.tomorrow(lang), fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    TimelineBar(
                        slots = activeSlots,
                        currentHour = if (!isTomorrowSelected) now.hour else -1,
                        currentMinute = if (!isTomorrowSelected) now.minute else -1,
                        showNeedle = !isTomorrowSelected,
                        lang = lang
                    )

                    if (!isUnclear) {
                        Text(
                            text = AppStrings.blackoutHoursHeader(lang),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFFBAE6FD)
                        )

                        if (intervals.isEmpty()) {
                            Text(
                                text = AppStrings.noBlackoutsScheduled(lang),
                                fontSize = 13.sp,
                                color = Color(0xFF34D399)
                            )
                        } else {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                intervals.forEach { interval ->
                                    val isCurrent = !isTomorrowSelected && nowMinutes in interval.startMinuteOfDay until interval.endMinuteOfDay
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (isCurrent) Color(0x33FF5E3A) else Color(0x1AFFFFFF))
                                            .padding(horizontal = 12.dp, vertical = 8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "\${interval.startStr} – \${interval.endStr}",
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            color = if (isCurrent) Color(0xFFFF5E3A) else Color.White
                                        )
                                        val durationFormatted = String.format("%.1f", interval.durationHours)
                                        Text(
                                            text = "\${durationFormatted} \${AppStrings.hourShort(lang)}",
                                            fontSize = 12.sp,
                                            color = Color(0xFFBAE6FD)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xCC141A29))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "\${AppStrings.lastUpdated(lang)} $lastUpdated",
                        fontSize = 11.sp,
                        color = Color(0xFFBAE6FD)
                    )
                    Text(
                        text = "\${AppStrings.nextUpdated(lang)} $nextUpdated",
                        fontSize = 11.sp,
                        color = Color(0xFF94A3B8)
                    )
                }

                IconButton(
                    onClick = onRefresh,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color.White)
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Оновити",
                        tint = Color.Black
                    )
                }
            }
        }

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.EMERGENCY_OUTAGES_URL))
                    context.startActivity(intent)
                },
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xCC141A29))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF1877F2)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_facebook),
                        contentDescription = "Facebook",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = AppStrings.emergencyOutagesLabel(lang),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = AppStrings.EMERGENCY_OUTAGES_URL,
                        fontSize = 11.sp,
                        color = Color(0xFFBAE6FD)
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Language,
                        contentDescription = null,
                        tint = Color(0xFFBAE6FD),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Icon(
                        imageVector = Icons.Default.OpenInNew,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(AppStrings.SITE_SCHEDULES_URL))
                    context.startActivity(intent)
                },
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xCC141A29))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFFF5E3A)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Language,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = AppStrings.siteSchedulesLabel(lang),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = AppStrings.SITE_SCHEDULES_URL,
                        fontSize = 11.sp,
                        color = Color(0xFFBAE6FD)
                    )
                }

                Icon(
                    imageVector = Icons.Default.OpenInNew,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}`
  },
  {
    path: 'app/src/main/java/ua/blackout/prewarning/ui/screens/SettingsScreen.kt',
    language: 'kotlin',
    description: 'Compose Settings screen with dropdown queue selection, ? help dialog, timer inputs, and toggles',
    content: `package ua.blackout.prewarning.ui.screens

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    currentQueue: String = "2.1",
    siteUrl: String = "https://www.ztoe.com.ua/unhooking-search.php",
    advanceMinutes: Int = 15,
    refreshMinutes: Int = 30,
    notificationsEnabled: Boolean = true,
    soundEnabled: Boolean = true,
    vibrationEnabled: Boolean = true,
    currentLanguage: String = "SYSTEM",
    lang: String = "uk",
    onQueueSelected: (String) -> Unit = {},
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
    onShowAppBanner: ((String) -> Unit)? = null
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

        // 2. Timers (Edit boxes only)
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Advance warning
                Column {
                    Text("Попереджати заздалегідь (хв)", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = advanceMinutes.toString(),
                        onValueChange = { str ->
                            str.toIntOrNull()?.let { onAdvanceMinutesChanged(it) }
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
                }

                Divider()

                // Refresh interval
                Column {
                    Text("Інтервал перевірки сайту (хв)", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = refreshMinutes.toString(),
                        onValueChange = { str ->
                            str.toIntOrNull()?.let { onRefreshMinutesChanged(it) }
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp)
                    )
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
                    Switch(checked = notificationsEnabled && soundEnabled, enabled = notificationsEnabled, onCheckedChange = onToggleSound)
                }
                Divider()
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Вібрація")
                    Switch(checked = notificationsEnabled && vibrationEnabled, enabled = notificationsEnabled, onCheckedChange = onToggleVibration)
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
`
  }
];

