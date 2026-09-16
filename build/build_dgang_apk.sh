#!/usr/bin/env bash
# DGang APK build — WebView wrapper around the PWA (no Gradle)
set -euo pipefail
BT=/home/ubuntu/android/build-tools/android-14
PLAT=/home/ubuntu/android/platforms/android-34/android.jar
APP=/home/ubuntu/android/dgang-app
WEB=/home/ubuntu/social-app/public
KS=/home/ubuntu/android/dgang.keystore
PASS=dgang123
PKG=mn.bad.dgang
URL="${DGANG_URL:-https://dgang.bad.mn/}"

rm -rf "$APP"; mkdir -p "$APP/src/mn/bad/dgang" "$APP/res/mipmap" "$APP/build"
echo "WebView targets: $URL"

cat > "$APP/AndroidManifest.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="$PKG" android:versionCode="1" android:versionName="1.0">
    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="34"/>
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.CAMERA"/>
    <uses-permission android:name="android.permission.RECORD_AUDIO"/>
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
    <application android:label="DGang" android:icon="@mipmap/icon"
        android:theme="@android:style/Theme.Material.NoActionBar.Fullscreen"
        android:hardwareAccelerated="true" android:usesCleartextTraffic="false">
        <activity android:name=".MainActivity" android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:launchMode="singleTask">
            <intent-filter><action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/></intent-filter>
        </activity>
    </application>
</manifest>
EOF

cat > "$APP/src/mn/bad/dgang/MainActivity.java" <<'EOF'
package mn.bad.dgang;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.view.Window;
import android.view.WindowManager;

public class MainActivity extends Activity {
    private WebView web;
    private ValueCallback<Uri[]> filePath;
    @Override protected void onCreate(Bundle b){
        super.onCreate(b);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        web = new WebView(this);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url){
                if(url.startsWith("http://")||url.startsWith("https://")){ v.loadUrl(url); return false; }
                try{ startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); return true; }catch(Exception e){ return false; }
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onPermissionRequest(PermissionRequest r){ r.grant(r.getResources()); }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> c, FileChooserParams p){
                filePath = c; Intent i = p.createIntent(); i.addCategory(Intent.CATEGORY_OPENABLE);
                try{ startActivityForResult(Intent.createChooser(i,"Select"), 1); return true; }catch(Exception e){ return false; }
            }
        });
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setLoadsImagesAutomatically(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        setContentView(web);
        web.loadUrl("URL_PLACEHOLDER");
    }
    @Override protected void onActivityResult(int req,int res,Intent data){ super.onActivityResult(req,res,data);
        if(req==1&&filePath!=null){ Uri[] r=data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null; filePath.onReceiveValue(r); filePath=null; } }
    @Override public void onBackPressed(){ if(web!=null&&web.canGoBack())web.goBack(); else super.onBackPressed(); }
}
EOF
sed -i "s|URL_PLACEHOLDER|$URL|" "$APP/src/mn/bad/dgang/MainActivity.java"

# icon
cp "$WEB/icons/icon-512.png" "$APP/res/mipmap/icon.png"; chmod 644 "$APP/res/mipmap/icon.png"

if [ ! -f "$KS" ]; then
  keytool -genkeypair -v -keystore "$KS" -alias dgang -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" -dname "CN=DGang, O=DGang, C=IN" >/dev/null 2>&1
fi

cd "$APP"
echo "[1/7] aapt2 compile"; $BT/aapt2 compile --dir res -o build/compiled.zip
echo "[2/7] aapt2 link"; $BT/aapt2 link -o build/unsigned.apk -I "$PLAT" --manifest AndroidManifest.xml -R build/compiled.zip --java build/
echo "[3/7] javac"; mkdir -p build/classes
javac -source 1.8 -target 1.8 -d build/classes -cp "$PLAT" $(find build -name 'R.java') src/mn/bad/dgang/MainActivity.java
echo "[4/7] d8"; mkdir -p build/apk
$BT/d8 --release --lib "$PLAT" --output build/apk $(find build/classes -name '*.class')
echo "[5/7] package dex"; mkdir -p build/unsigned && cd build/unsigned
unzip -o ../unsigned.apk >/dev/null
cp ../apk/classes.dex ./classes.dex
zip -r ../withdex.apk . >/dev/null
cd "$APP"
echo "[6/7] zipalign"; $BT/zipalign -f 4 build/withdex.apk build/aligned.apk
echo "[7/7] sign"; $BT/apksigner sign --ks "$KS" --ks-pass "pass:$PASS" --out "$APP/DGang.apk" build/aligned.apk
echo "=== VERIFY ==="
$BT/apksigner verify --verbose "$APP/DGang.apk" 2>&1 | grep -E "Verifies"
$BT/aapt2 dump badging "$APP/DGang.apk" 2>&1 | grep -E "package:|versionName|launchable|application-label" | head -5
cp "$APP/DGang.apk" /var/www/nynmondal/html/roomsplit/DGang.apk 2>/dev/null || true
echo "APK: $APP/DGang.apk ($(du -h "$APP/DGang.apk" | cut -f1))"