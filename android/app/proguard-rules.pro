# Add project specific ProGuard rules here.
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# Capacitor
-keep class com.getcapacitor.** { *; }
-keep class com.nexus.chathub.** { *; }

# React Native
-keep class com.facebook.react.** { *; }

# Keep native methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}
