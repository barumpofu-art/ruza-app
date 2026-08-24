package app.kalahari.manager;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * A WebView shell around the game, which lives in the APK's assets. Assets are
 * served from a virtual https origin rather than file://, so the page is a
 * secure context with real localStorage for the save.
 */
public class MainActivity extends Activity {

  private static final String HOST = "appassets.androidplatform.net";
  private static final String START_URL = "https://" + HOST + "/index.html";

  private WebView web;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Debug builds expose the page to devtools, which is how CI drives it.
    if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
      WebView.setWebContentsDebuggingEnabled(true);
    }

    web = new WebView(this);
    web.setBackgroundColor(0xFF0D1310);

    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setSupportZoom(false);
    settings.setBuiltInZoomControls(false);
    settings.setTextZoom(100);
    settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

    web.setWebViewClient(new WebViewClient() {
      @Override
      public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        return serve(request.getUrl());
      }

      @Override
      public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        // Everything the game needs is inside the APK; nothing may navigate away.
        return !HOST.equals(request.getUrl().getHost());
      }
    });

    // The page registers a service worker; its requests need the same treatment.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
          return serve(request.getUrl());
        }
      });
    }

    setContentView(web);

    if (savedInstanceState == null) {
      web.loadUrl(START_URL);
    } else {
      web.restoreState(savedInstanceState);
    }
  }

  private WebResourceResponse serve(Uri url) {
    if (url == null || !HOST.equals(url.getHost())) return null;

    String path = url.getPath();
    if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
    String asset = path.startsWith("/") ? path.substring(1) : path;
    if (asset.contains("..")) return notFound();

    try {
      InputStream stream = getAssets().open(asset);
      WebResourceResponse response = new WebResourceResponse(mimeType(asset), "utf-8", stream);
      Map<String, String> headers = new HashMap<>();
      headers.put("Cache-Control", "no-store");
      response.setResponseHeaders(headers);
      return response;
    } catch (IOException missing) {
      return notFound();
    }
  }

  private WebResourceResponse notFound() {
    return new WebResourceResponse(
        "text/plain", "utf-8", 404, "Not Found",
        new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
  }

  private static String mimeType(String asset) {
    String name = asset.toLowerCase(Locale.ROOT);
    if (name.endsWith(".html")) return "text/html";
    if (name.endsWith(".js")) return "text/javascript";
    if (name.endsWith(".css")) return "text/css";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".svg")) return "image/svg+xml";
    if (name.endsWith(".webmanifest")) return "application/manifest+json";
    if (name.endsWith(".json")) return "application/json";
    return "application/octet-stream";
  }

  @Override
  protected void onSaveInstanceState(Bundle outState) {
    super.onSaveInstanceState(outState);
    web.saveState(outState);
  }

  @Override
  @SuppressWarnings("deprecation")
  public void onBackPressed() {
    // Let the page close an open sheet or match view first.
    web.evaluateJavascript(
        "(window.__androidBack && window.__androidBack()) ? 'handled' : 'no'",
        value -> {
          if (value == null || !value.contains("handled")) finish();
        });
  }

  @Override
  protected void onDestroy() {
    if (web != null) {
      web.destroy();
      web = null;
    }
    super.onDestroy();
  }
}
