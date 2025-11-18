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
    let directionText = "Long";
    let directionColor = "#00ff88";
    if (direction === "Short" || direction === "Sell") {
      directionText = "Short";
      directionColor = "#ff4757";
    }

    const profitColor = "#00ff88";
    const backgroundImageUrl = "https://res.cloudinary.com/dtbc3aa1o/image/upload/c_fill,w_650,h_800,g_auto/v1763460536/biii_ubtzty.jpg";

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
          {/* 交易对信息 - 使用更圆润的字体 */}
          <div
            style={{
              position: "absolute",
              left: "45px",
              top: "295px",
              fontSize: "32px",
              fontWeight: "900", // 使用最大字重
              color: "#ffffff",
              display: "flex",
              fontFamily: '"Comic Sans MS", "Arial Rounded MT Bold", "Helvetica Rounded", Arial, sans-serif',
              textShadow: "1px 1px 2px rgba(0,0,0,0.3)", // 添加轻微阴影增强立体感
            }}
          >
            {formatSymbol(symbol)} Perpetual
          </div>

          {/* 方向和杠杆 */}
          <div
            style={{
              position: "absolute",
              left: "45px",
              top: "350px",
              fontSize: "23px",
              fontWeight: "900", // 增加字重
              display: "flex",
              gap: "25px",
              fontFamily: '"Comic Sans MS", "Arial Rounded MT Bold", Arial, sans-serif',
            }}
          >
            <span style={{ color: directionColor }}>
              {directionText}
            </span>
            <span style={{ color: "#ffffff" }}>
              75x
            </span>
          </div>

          {/* 盈利百分比 - 使用更圆润的字体并增强效果 */}
          <div
            style={{
              position: "absolute",
              left: "45px",
              top: "425px",
              color: profitColor,
              fontSize: "60px", // 稍微增大字体
              fontWeight: "900", // 最大字重
              display: "flex",
              fontFamily: '"Comic Sans MS", "Arial Rounded MT Bold", "Helvetica Rounded", Arial, sans-serif',
              textShadow: "2px 2px 4px rgba(0,0,0,0.5)", // 更强的阴影
              letterSpacing: "1px", // 稍微增加字母间距
            }}
          >
            {parseFloat(profit) >= 0 ? "+" : ""}{profit}%
          </div>

          {/* 价格数值 - 横向排列，移除Entry/Price字样 */}
          <div
            style={{
              position: "absolute",
              left: "45px",
              top: "575px",
              display: "flex",
              flexDirection: "row",
              gap: "240px",
            }}
          >
            <div style={{ 
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}>
              <div style={{ 
                color: "#ffffff", 
                fontSize: "24px", // 稍微增大
                fontWeight: "900", // 最大字重
                fontFamily: '"Comic Sans MS", "Arial Rounded MT Bold", "Helvetica Rounded", Arial, sans-serif',
                textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
              }}>
                {entry}
              </div>
            </div>
            <div style={{ 
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}>
              <div style={{ 
                color: "#ffffff", 
                fontSize: "24px", // 稍微增大
                fontWeight: "900", // 最大字重
                fontFamily: '"Comic Sans MS", "Arial Rounded MT Bold", "Helvetica Rounded", Arial, sans-serif',
                textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
              }}>
                {priceDisplay}
              </div>
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
              fontSize: "23px",
              display: "flex",
              fontFamily: '"Comic Sans MS", "Arial Rounded MT Bold", Arial, sans-serif',
            }}
          >
            Infinity Crypto
          </div>
        </div>
      ),
      {
        width: 650,
        height: 800,
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

// 辅助函数：格式化交易对符号
function formatSymbol(symbol) {
  if (!symbol) return "ETHUSDT";
  
  // 移除 .P 后缀
  let formatted = symbol.replace('.P', '');
  
  // 确保以 USDT 结尾
  if (!formatted.endsWith('USDT')) {
    // 如果符号不包含 USDT，添加 USDT
    if (!formatted.includes('USDT')) {
      formatted = formatted + 'USDT';
    }
  }
  
  return formatted;
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
