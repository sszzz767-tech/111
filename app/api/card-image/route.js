export async function GET(request) {
  try {
    // ==================== Debug Info ====================
    console.log("=== Image Generation Debug ===");
    console.log("Full Request URL:", request.url);
    const { searchParams } = new URL(request.url);
    console.log("All Query Parameters:");
    console.log("- status:", searchParams.get("status"));
    console.log("- symbol:", searchParams.get("symbol"));
    console.log("- direction:", searchParams.get("direction"));
    console.log("- price param:", searchParams.get("price"), "(raw value)");
    console.log("- entry param:", searchParams.get("entry"), "(raw value)");
    console.log("- profit param:", searchParams.get("profit"));
    console.log("- _t param:", searchParams.get("_t"));
    // ==================== Debug Info End ====================

    console.log("Received image generation request");
    console.log("Query parameters:", Object.fromEntries(searchParams.entries()));

    // Get query parameters - fixed price parameter handling
    const status = searchParams.get("status") || "ENTRY";
    const symbol = searchParams.get("symbol") || "ETHUSDT.P";
    const direction = searchParams.get("direction") || "Buy";

    // Fix: Ensure price parameter is handled correctly
    const rawPrice = searchParams.get("price");
    const rawEntry = searchParams.get("entry");

    // If price is empty, decide what value to use based on message type
    let priceDisplay = "-";
    if (rawPrice) {
      priceDisplay = formatPriceSmart(rawPrice);
    } else {
      // For different status messages, use different default values
      if (status === "TP1" || status === "TP2") {
        // For profit messages, if no price, use entry as fallback
        priceDisplay = formatPriceSmart(rawEntry || "-");
      } else if (status === "BREAKEVEN") {
        // For breakeven messages, use trigger price or entry
        priceDisplay = formatPriceSmart(rawEntry || "-");
      } else {
        priceDisplay = "-";
      }
    }

    const entry = formatPriceSmart(rawEntry || "4387.38");
    const profit = searchParams.get("profit") || "115.18";

    // ==================== Verify Final Display Values ====================
    console.log("Final Display Values:");
    console.log("- price display:", priceDisplay);
    console.log("- entry display:", entry);

    // Set image dimensions
    const width = 600;
    const height = 350;

    // Set colors and text based on direction
    let directionText = "Buy";
    let directionColor = "#00ff88"; // Green
    
    if (direction === "Short" || direction === "Sell") {
      directionText = "Sell";
      directionColor = "#ff4757"; // Red
    }
    
    const profitColor = "#00ff88";

    // Use Cloudinary image URL
    let backgroundImageUrl = "https://res.cloudinary.com/dtbc3aa1o/image/upload/v1763460536/biii_ubtzty.jpg";
    console.log("Using background image:", backgroundImageUrl);
    
    // Verify image accessibility
    let isAccessible = false;
    try {
      isAccessible = await isImageAccessible(backgroundImageUrl);
      console.log("Image accessibility:", isAccessible);
    } catch (error) {
      console.error("Image validation error:", error);
      isAccessible = false;
    }
    
    if (!isAccessible) {
      console.error("Cloudinary image not accessible, using fallback");
      backgroundImageUrl = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMGExZTE3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmFkaWVudCkiIC8+Cjwvc3ZnPg==";
    }

    console.log("Starting image response generation");

    // Return image response
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            flexDirection: "column",
            backgroundColor: "#0a0e17",
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            fontFamily: '"PingFang SC", "Helvetica Neue", Arial, sans-serif',
            padding: "15px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Content Container - Explicitly set display: flex */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              height: "100%",
              position: "relative",
            }}
          >
            {/* Symbol Information */}
            <div
              style={{
                position: "absolute",
                left: "45px",
                top: "85px",
                fontSize: "22px",
                fontWeight: "bold",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span style={{ color: directionColor }}>
                {directionText}
              </span>
              <span style={{ color: "#ffffff" }}>|</span>
              <span style={{ color: "#ffffff" }}>75x</span>
              <span style={{ color: "#ffffff" }}>|</span>
              <span style={{ color: "#ffffff" }}>
                {symbol.replace('.P', '')} Perpetual
              </span>
            </div>

            {/* Profit Percentage */}
            <div
              style={{
                position: "absolute",
                left: "45px",
                top: "140px",
                color: profitColor,
                fontSize: "40px",
                fontWeight: "bold",
                display: "flex",
              }}
            >
              {parseFloat(profit) >= 0 ? "+" : ""}{profit}%
            </div>

            {/* Price Values - Vertical Layout */}
            <div
              style={{
                position: "absolute",
                left: "170px",
                top: "220px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ 
                display: "flex",
                color: "#b8b800", 
                fontSize: "22px",
                fontWeight: "bold",
              }}>
                Entry: {entry}
              </div>
              <div style={{ 
                display: "flex",
                color: "#b8b800", 
                fontSize: "22px",
                fontWeight: "bold",
              }}>
                Price: {priceDisplay}
              </div>
            </div>

            {/* Bottom Info - Centered */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: "10px",
                transform: "translateX(-50%)",
                color: "#a0a0c0",
                fontSize: "16px",
                display: "flex",
              }}
            >
              Infinity Crypto
            </div>
          </div>
        </div>
      ),
      {
        width,
        height,
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (error) {
    console.error("Error generating image:", error);
    
    return new Response(
      JSON.stringify({
        error: "Image generation failed",
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}
