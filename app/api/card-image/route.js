import { ImageResponse } from '@vercel/og';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const status = searchParams.get("status") || "ENTRY";
    const symbol = searchParams.get("symbol") || "ETHUSDT.P";
    const direction = searchParams.get("direction") || "Buy";
    const rawPrice = searchParams.get("price");
    const rawEntry = searchParams.get("entry");
    const profit = searchParams.get("profit") || "115.18";

    // 处理价格显示逻辑
    let priceDisplay = "-";
    if (rawPrice) {
      priceDisplay = formatPriceSmart(rawPrice);
    } else {
      if (status === "TP1" || status === "TP2") {
        priceDisplay = formatPriceSmart(rawEntry || "-");
      } else if (status === "BREAKEVEN") {
        priceDisplay = formatPriceSmart(rawEntry || "-");
      } else {
        priceDisplay = "-";
      }
    }

    const entry = formatPriceSmart(rawEntry || "4387.38");

    // 根据方向设置颜色和文本
    let directionText = "Buy";
    let directionColor = "#00ff88";
    if (direction === "Short" || direction === "Sell") {
      directionText = "Sell";
      directionColor = "#ff4757";
    }

    const profitColor = "#00ff88";
    const backgroundImageUrl = "https://res.cloudinary.com/dtbc3aa1o/image/upload/v1763460536/biii_ubtzty.jpg";

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
          {/* 交易对信息 */}
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

          {/* 盈利百分比 */}
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

          {/* 价格数值 - 上下排列 */}
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

          {/* 底部信息 - 居中 */}
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
      ),
      {
        width: 600,
        height: 350,
      }
    );
  } catch (error) {
    console.error("生成图片时出错:", error);
    return new Response(
      JSON.stringify({
        error: "生成图片失败",
        message: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

// 辅助函数：格式化价格
function formatPriceSmart(value) {
  if (value === null || value === undefined) return "-";
  
  if (typeof value === 'string') {
    const decimalIndex = value.indexOf('.');
    if (decimalIndex === -1) return value + ".00";
    
    const decimalPart = value.substring(decimalIndex + 1);
    const decimalLength = decimalPart.length;
    
    if (decimalLength === 0) return value + "00";
    if (decimalLength === 1) return value + "0";
    if (decimalLength > 5) {
      const integerPart = value.substring(0, decimalIndex);
      return integerPart + '.' + decimalPart.substring(0, 5);
    }
    
    return value;
  }
  
  const strValue = value.toString();
  const decimalIndex = strValue.indexOf('.');
  
  if (decimalIndex === -1) return strValue + ".00";
  
  const decimalPart = strValue.substring(decimalIndex + 1);
  const decimalLength = decimalPart.length;
  
  if (decimalLength === 0) return strValue + "00";
  if (decimalLength === 1) return strValue + "0";
  if (decimalLength > 5) return value.toFixed(5);
  
  return strValue;
}
