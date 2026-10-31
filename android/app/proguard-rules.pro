# Keep data models
-keep class ua.blackout.prewarning.data.model.** { *; }

# Keep Glance app widget
-keep class ua.blackout.prewarning.widget.** { *; }

# Keep WorkManager worker
-keep class ua.blackout.prewarning.worker.** { *; }

# Keep BroadcastReceivers
-keep class ua.blackout.prewarning.receiver.** { *; }

# Keep Jsoup and ignore its compile-time nullability annotations in R8
-keep class org.jsoup.** { *; }
-dontwarn org.jsoup.**
-dontwarn org.jspecify.annotations.**
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.animal_sniffer.**
