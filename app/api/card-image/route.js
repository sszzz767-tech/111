import { NextResponse } from "next/server";

// 添加这行来强制动态渲染
export const dynamic = 'force-dynamic';

// 辅助函数
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

// 检查图片是否可访问
async function isImageAccessible(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function GET(request) {
  try {
    console.log("=== Image Generation Debug ===");
    
    // 使用 searchParams 而不是 request.url
    const { searchParams } = new URL(request.url);
    console.log("所有查询参数:");
    console.log("- status:", searchParams.get("status"));
    console.log("- symbol:", searchParams.get("symbol"));
    console.log("- direction:", searchParams.get("direction"));
    console.log("- price参数:", searchParams.get("price"), "(原始值)");
    console.log("- entry参数:", searchParams.get("entry"), "(原始值)");
    console.log("- profit参数:", searchParams.get("profit"));
    console.log("- _t参数:", searchParams.get("_t"));

    // 获取查询参数
    const status = searchParams.get("status") || "ENTRY";
    const symbol = searchParams.get("symbol") || "ETHUSDT.P";
    const direction = searchParams.get("direction") || "Buy";

    // 修复：确保price参数正确处理
    const rawPrice = searchParams.get("price");
    const rawEntry = searchParams.get("entry");

    // 如果price为空，根据消息类型决定使用什么值
    let priceDisplay = "-";
    if (rawPrice) {
      priceDisplay = formatPriceSmart(rawPrice);
    } else {
      // 对于不同状态的消息，使用不同的默认值
      if (status === "TP1" || status === "TP2") {
        // 对于止盈消息，如果没有price，使用entry作为备选
        priceDisplay = formatPriceSmart(rawEntry || "-");
      } else if (status === "BREAKEVEN") {
        // 对于保本消息，使用触发价格或entry
        priceDisplay = formatPriceSmart(rawEntry || "-");
      } else {
        priceDisplay = "-";
      }
    }

    const entry = formatPriceSmart(rawEntry || "4387.38");
    const profit = searchParams.get("profit") || "115.18";

    // ==================== 验证最终显示的值 ====================
    console.log("最终显示值:");
    console.log("- price显示:", priceDisplay);
    console.log("- entry显示:", entry);

    // 设置图片宽高
    const width = 600;
    const height = 350;

    // 根据方向设置颜色和文本
    let directionText = "Buy";
    let directionColor = "#00ff88"; // 绿色
    
    if (direction === "Short" || direction === "Sell") {
      directionText = "Sell";
      directionColor = "#ff4757"; // 红色
    }
    
    const profitColor = "#00ff88";

    // 使用 Cloudinary 图片链接
    let backgroundImageUrl = "https://res.cloudinary.com/dtbc3aa1o/image/upload/v1763460536/biii_ubtzty.jpg";
    console.log("使用背景图片:", backgroundImageUrl);
    
    // 验证图片是否可访问
    let isAccessible = false;
    try {
      isAccessible = await isImageAccessible(backgroundImageUrl);
      console.log("图片可访问性:", isAccessible);
    } catch (error) {
      console.error("图片验证出错:", error);
      isAccessible = false;
    }
    
    if (!isAccessible) {
      console.error("Cloudinary 图片无法访问，使用备用方案");
      backgroundImageUrl = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMGExZTE3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmFkaWVudCkiIC8+Cjwvc3ZnPg==";
    }

    console.log("开始生成图片响应");

    // 返回图片响应
    return new Response(
      `
      <div style="display: flex; width: 100%; height: 100%; flex-direction: column; background-color: #0a0e17; background-image: url('${backgroundImageUrl}'); background-size: cover; background-position: center; font-family: 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; padding: 15px; position: relative; overflow: hidden;">
        <div style="display: flex; flex-direction: column; width: 100%; height: 100%; position: relative;">
          <!-- 交易对信息 -->
          <div style="position: absolute; left: 45px; top: 85px; font-size: 22px; font-weight: bold; color: #ffffff; display: flex; align-items: center; gap: 8px">
            <span style="color: ${directionColor}">${directionText}</span>
            <span style="color: #ffffff">|</span>
            <span style="color: #ffffff">75x</span>
            <span style="color: #ffffff">|</span>
            <span style="color: #ffffff">${symbol.replace('.P', '')} Perpetual</span>
          </div>

          <!-- 盈利百分比 -->
          <div style="position: absolute; left: 45px; top: 140px; color: ${profitColor}; font-size: 40px; font-weight: bold; display: flex;">
            ${parseFloat(profit) >= 0 ? "+" : ""}${profit}%
          </div>

          <!-- 价格数值 - 上下排列 -->
          <div style="position: absolute; left: 170px; top: 220px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; color: #b8b800; font-size: 22px; font-weight: bold;">
              Entry: ${entry}
            </div>
            <div style="display: flex; color: #b8b800; font-size: 22px; font-weight: bold;">
              Price: ${priceDisplay}
            </div>
          </div>

          <!-- 底部信息 - 居中 -->
          <div style="position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); color: #a0a0c0; font-size: 16px; display: flex;">
            Infinity Crypto
          </div>
        </div>
      </div>
      `,
      {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (error) {
    console.error("生成图片时出错:", error);
    
    return new Response(
      JSON.stringify({
        error: "生成图片失败",
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
