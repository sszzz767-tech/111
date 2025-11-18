export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";

const DINGTALK_WEBHOOK = process.env.DINGTALK_WEBHOOK || "0";
const RELAY_SERVICE_URL = process.env.RELAY_SERVICE_URL || "https://send-todingtalk-pnvjfgztkw.cn-hangzhou.fcapp.run";
const TENCENT_CLOUD_KOOK_URL = process.env.TENCENT_CLOUD_KOOK_URL || "https://1323960433-epanz6yymx.ap-guangzhou.tencentscf.com";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const USE_RELAY_SERVICE = process.env.USE_RELAY_SERVICE === "true";
const SEND_TO_KOOK = process.env.SEND_TO_KOOK === "true";
const SEND_TO_DISCORD = process.env.SEND_TO_DISCORD === "true";
const DEFAULT_KOOK_CHANNEL_ID = process.env.DEFAULT_KOOK_CHANNEL_ID || "0";

const lastEntryBySymbol = Object.create(null);

// Helper Functions
function toLines(s) {
  return String(s).replace(/,\s*/g, "\n").replace(/\\n/g, "\n");
}

function getNum(text, key) {
  const re = new RegExp(`${key}\\s*[:：]\\s*([0-9]+(?:\\.[0-9]+)?)`);
  const m = String(text).match(re);
  return m ? parseFloat(m[1]) : null;
}

function getStr(text, key) {
  const re = new RegExp(`${key}\\s*[:：]\\s*([^,\\n]+)`);
  const m = String(text).match(re);
  return m ? m[1].trim() : null;
}

function getSymbol(text) {
  const symbol = getStr(text, "品种");
  return symbol ? symbol.split(' ')[0].replace(/[^a-zA-Z0-9.]/g, '') : null;
}

function getDirection(text) {
  const direction = getStr(text, "方向");
  return direction ? direction.replace(/[^多头空头]/g, '') : null;
}

// 方向翻译函数 - 添加详细调试
function translateDirection(direction) {
  console.log("=== translateDirection Debug ===");
  console.log("Input direction:", direction);
  let result;
  if (direction === "多头") result = "Long";
  else if (direction === "空头") result = "Short";
  else result = direction || "Long";
  console.log("Output direction:", result);
  console.log("=== End translateDirection Debug ===");
  return result;
}

function getLatestPrice(text) {
  return getNum(text, "最新价格") || getNum(text, "当前价格") || getNum(text, "市价");
}

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

function calcAbsProfitPct(entry, target) {
  if (entry == null || target == null) return null;
  const pct = ((target - entry) / entry) * 100;
  return Math.abs(pct);
}

function isTP2(t) { return /TP2达成/.test(t); }
function isTP1(t) { return /TP1达成/.test(t); }
function isBreakeven(t) { return /已到保本位置/.test(t); }
function isBreakevenStop(t) { return /保本止损.*触发/.test(t); }
function isInitialStop(t) { return /初始止损.*触发/.test(t); }
function isEntry(t) {
  return /【开仓】/.test(t) || (/开仓价格/.test(t) && !isTP1(t) && !isTP2(t) && !isBreakeven(t) && !isBreakevenStop(t) && !isInitialStop(t));
}

function extractProfitPctFromText(t) {
  const m = String(t).match(/(盈利|带杠杆盈利|累计带杠杆盈利)\s*[:：]?\s*([+-]?\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[2]) : null;
}

function adjustWinRate(winRate) {
  if (winRate === null || winRate === undefined) return null;
  const adjusted = Math.min(100, winRate + 3);
  return parseFloat(adjusted.toFixed(2));
}

function removeDuplicateLines(text) {
  const lines = text.split('\n');
  const seen = new Set();
  const result = [];
  
  let hasSymbol = false, hasDirection = false, hasEntryPrice = false, hasTriggerPrice = false;
  let hasHoldTime = false, hasLossPercent = false, hasInstruction = false, hasPosition = false;
  let hasLeverage = false, hasProfit = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const isSymbolLine = /品种\s*[:：]/.test(trimmed);
    const isDirectionLine = /方向\s*[:：]/.test(trimmed);
    const isEntryPriceLine = /开仓价格\s*[:：]/.test(trimmed);
    const isTriggerPriceLine = /触发价格\s*[:：]/.test(trimmed);
    const isHoldTimeLine = /持仓时间\s*[:：]/.test(trimmed);
    const isLossPercentLine = /损失比例\s*[:：]/.test(trimmed);
    const isInstructionLine = /系统操作\s*[:：]/.test(trimmed);
    const isPositionLine = /仓位\s*[:：]/.test(trimmed);
    const isLeverageLine = /杠杆倍数\s*[:：]/.test(trimmed);
    const isProfitLine = /盈利\s*[:：]/.test(trimmed);
    
    if ((isSymbolLine && hasSymbol) || (isDirectionLine && hasDirection) || (isEntryPriceLine && hasEntryPrice) || 
        (isTriggerPriceLine && hasTriggerPrice) || (isHoldTimeLine && hasHoldTime) || (isLossPercentLine && hasLossPercent) || 
        (isInstructionLine && hasInstruction) || (isPositionLine && hasPosition) || (isLeverageLine && hasLeverage) || 
        (isProfitLine && hasProfit)) continue;
    
    if (isSymbolLine) hasSymbol = true;
    if (isDirectionLine) hasDirection = true;
    if (isEntryPriceLine) hasEntryPrice = true;
    if (isTriggerPriceLine) hasTriggerPrice = true;
    if (isHoldTimeLine) hasHoldTime = true;
    if (isLossPercentLine) hasLossPercent = true;
    if (isInstructionLine) hasInstruction = true;
    if (isPositionLine) hasPosition = true;
    if (isLeverageLine) hasLeverage = true;
    if (isProfitLine) hasProfit = true;
    
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(line);
    }
  }
  
  return result.join('\n');
}

function extractPositionInfo(text) {
  const positionMatch = text.match(/开仓\s*(\d+(?:\.\d+)?)%\s*仓位/);
  const leverageMatch = text.match(/杠杆倍数\s*[:：]\s*(\d+)x/);
  const breakevenMatch = text.match(/移动止损到保本位\s*[:：]\s*(\d+(?:\.\d+)?)/);
  return {
    position: positionMatch ? positionMatch[1] + '%' : null,
    leverage: leverageMatch ? leverageMatch[1] + 'x' : null,
    breakeven: breakevenMatch ? breakevenMatch[1] : null
  };
}

function getImagePrice(rawData, entryPrice) {
  console.log("=== getImagePrice Detailed Debug ===");
  console.log("Raw data:", rawData);
  
  const latestPrice = getLatestPrice(rawData);
  console.log("- Latest price:", latestPrice);
  
  const closingPrice = getNum(rawData, "平仓价格");
  console.log("- Closing price:", closingPrice);
  
  let triggerPrice = null;
  if (isTP1(rawData)) {
    triggerPrice = getNum(rawData, "TP1价格") || getNum(rawData, "TP1") || closingPrice;
    console.log("- TP1 trigger price:", triggerPrice);
  } else if (isTP2(rawData)) {
    triggerPrice = getNum(rawData, "TP2价格") || getNum(rawData, "TP2") || closingPrice;
    console.log("- TP2 trigger price:", triggerPrice);
  } else if (isBreakeven(rawData)) {
    triggerPrice = closingPrice || getNum(rawData, "触发价格") || getNum(rawData, "保本位") || getNum(rawData, "移动止损到保本位");
    console.log("- Breakeven trigger price:", triggerPrice);
    
    if (!triggerPrice) {
      console.log("- Trying to extract price from breakeven message text...");
      const priceMatch = rawData.match(/(?:平仓价格|触发价格|保本位|移动止损到保本位)\s*[:：]\s*(\d+(?:\.\d+)?)/);
      if (priceMatch) {
        triggerPrice = parseFloat(priceMatch[1]);
        console.log("- Trigger price extracted from text:", triggerPrice);
      }
    }
  }
  
  console.log("- Entry price:", entryPrice);
  
  let finalPrice;
  if (closingPrice) {
    finalPrice = closingPrice;
    console.log("- Using closing price as final price");
  } else {
    if (isBreakeven(rawData)) {
      finalPrice = triggerPrice || latestPrice || entryPrice;
    } else {
      finalPrice = latestPrice || triggerPrice || entryPrice;
    }
  }
  
  console.log("- Final selected price:", finalPrice);
  console.log("=== getImagePrice Debug End ===");
  
  return finalPrice;
}

function generateImageURL(params) {
  const { status, symbol, direction, price, entry, profit, BASE } = params;
  const cleanSymbol = symbol ? symbol.replace(/[^a-zA-Z0-9.]/g, '') : '';
  
  // 确保方向是英文
  let cleanDirection;
  if (direction === "多头" || direction === "Long") {
    cleanDirection = "Long";
  } else if (direction === "空头" || direction === "Short") {
    cleanDirection = "Short";
  } else {
    cleanDirection = direction ? direction.replace(/[^a-zA-Z]/g, '') : 'Long';
  }
  
  const qs = new URLSearchParams({
    status: status || "",
    symbol: cleanSymbol,
    direction: cleanDirection,
    price: price ? formatPriceSmart(price) : "",
    entry: entry ? formatPriceSmart(entry) : "",
    profit: profit != null ? profit.toFixed(2) : "",
    _t: Date.now().toString()
  }).toString();

  const imageUrl = `${BASE}/api/card-image?${qs}`;
  
  console.log("=== Generated Image URL Debug ===");
  console.log("Base URL:", BASE);
  console.log("Full Image URL:", imageUrl);
  console.log("Parameters:", {
    status, symbol, direction, price, entry, profit
  });
  console.log("Cleaned direction:", cleanDirection);
  console.log("Query String:", qs);
  console.log("=== End Image URL Debug ===");
  
  return imageUrl;
}

const dingtalkEmojis = {
  "✅": "✅", "🎯": "🎯", "📈": "📈", "📊": "📊", "⚠️": "⚠️", "🔴": "🔴", "🟡": "🟡", 
  "🟢": "🟢", "🔄": "🔄", "⚖️": "⚖️", "💰": "💰", "🎉": "🎉", "✨": "✨"
};

function simplifyEmojis(text) {
  return text
    .replace(/\\uD83C\\uDFAF/g, dingtalkEmojis["🎯"]).replace(/\\uD83D\\uDFE1/g, dingtalkEmojis["🟡"])
    .replace(/\\uD83D\\uDFE2/g, dingtalkEmojis["🟢"]).replace(/\\uD83D\\uDD34/g, dingtalkEmojis["🔴"])
    .replace(/\\uD83D\\uDC4D/g, dingtalkEmojis["✅"]).replace(/\\u2705/g, dingtalkEmojis["✅"])
    .replace(/\\uD83D\\uDCC8/g, dingtalkEmojis["📈"]).replace(/\\uD83D\\uDCCA/g, dingtalkEmojis["📊"])
    .replace(/\\u26A0\\uFE0F/g, dingtalkEmojis["⚠️"]).replace(/\\uD83D\\uDD04/g, dingtalkEmojis["🔄"])
    .replace(/\\u2696\\uFE0F/g, dingtalkEmojis["⚖️"]).replace(/\\uD83D\\uDCB0/g, dingtalkEmojis["💰"])
    .replace(/\\uD83C\\uDF89/g, dingtalkEmojis["🎉"]).replace(/\\u2728/g, dingtalkEmojis["✨"]);
}

async function sendToKook(messageData, rawData, messageType, imageUrl = null) {
  if (!SEND_TO_KOOK) {
    console.log("KOOK sending not enabled, skipping");
    return { success: true, skipped: true };
  }

  try {
    console.log("=== Starting Tencent Cloud KOOK service send ===");
    const rawDirection = getDirection(rawData);
    const direction = translateDirection(rawDirection); // 翻译方向
    
    const kookPayload = {
      channelId: DEFAULT_KOOK_CHANNEL_ID,
      formattedMessage: messageData,
      messageType: messageType,
      imageUrl: imageUrl,
      timestamp: Date.now(),
      symbol: getSymbol(rawData),
      direction: direction // 使用翻译后的方向
    };

    const response = await fetch(TENCENT_CLOUD_KOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kookPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tencent Cloud response error:", errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("Tencent Cloud KOOK service response:", result);
    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to send to Tencent Cloud KOOK service:", error);
    return { success: false, error: error.message, skipped: false };
  }
}

async function sendToDiscord(messageData, rawData, messageType, imageUrl = null) {
  if (!SEND_TO_DISCORD || !DISCORD_WEBHOOK_URL) {
    console.log("Discord sending not enabled or webhook not configured, skipping");
    return { success: true, skipped: true };
  }

  try {
    console.log("=== Starting Discord send ===");
    let discordMessage = messageData
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/📊 Trading Chart: https?:\/\/[^\s]+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    if (!discordMessage || discordMessage.trim().length === 0) {
      console.log("Discord message empty, skipping send");
      return { success: true, skipped: true, reason: "Empty message" };
    }
    
    let color = 0x0099FF;
    let title = "Trading Notification";
    switch(messageType) {
      case "TP2": color = 0x00FF00; title = "🎉 TP2 Reached"; break;
      case "TP1": color = 0x00FF00; title = "✨ TP1 Reached"; break;
      case "ENTRY": color = 0xFFFF00; title = "✅ Entry Signal"; break;
      case "BREAKEVEN": color = 0x00FF00; title = "🎯 Breakeven Reached"; break;
      case "BREAKEVEN_STOP": color = 0xFFA500; title = "🟡 Breakeven Stop Triggered"; break;
      case "INITIAL_STOP": color = 0xFF0000; title = "🔴 Initial Stop Triggered"; break;
    }
    
    const discordPayload = {
      content: `🔔 **${title}**`,
      embeds: [{
        title: "Infinity Crypto AI Trading Signal",
        description: discordMessage,
        color: color,
        timestamp: new Date().toISOString(),
        footer: { text: "Infinity Crypto - AI Trading System" }
      }]
    };

    if (imageUrl) {
      console.log("=== Regenerating Discord image URL ===");
      const symbol = getSymbol(rawData);
      const rawDirection = getDirection(rawData);
      const translatedDirection = translateDirection(rawDirection); // 翻译方向并保存到新变量
      const entryPrice = getNum(rawData, "开仓价格");
      
      const correctPrice = getImagePrice(rawData, entryPrice);
      const profitPercent = extractProfitPctFromText(rawData) || (entryPrice && correctPrice ? calcAbsProfitPct(entryPrice, correctPrice) : null);

      let status = "INFO";
      if (isTP1(rawData)) status = "TP1";
      if (isTP2(rawData)) status = "TP2";
      if (isBreakeven(rawData)) status = "BREAKEVEN";

      console.log("Regenerated parameters:");
      console.log("- status:", status);
      console.log("- symbol:", symbol);
      console.log("- translatedDirection:", translatedDirection);
      console.log("- correctPrice:", correctPrice);
      console.log("- entryPrice:", entryPrice);
      console.log("- profitPercent:", profitPercent);

      const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://nextjs-boilerplate-ochre-nine-90.vercel.app";
      const discordImageUrl = generateImageURL({
        status, 
        symbol, 
        direction: translatedDirection, // 使用翻译后的方向
        price: correctPrice, 
        entry: entryPrice, 
        profit: profitPercent, 
        BASE
      });

      console.log("Original image URL:", imageUrl);
      console.log("Regenerated Discord image URL:", discordImageUrl);
      discordPayload.embeds[0].image = { url: discordImageUrl };
    }

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify(discordPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Discord response error:", errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    console.log("Discord message sent successfully");
    return { success: true };
  } catch (error) {
    console.error("Failed to send to Discord:", error);
    return { success: false, error: error.message, skipped: false };
  }
}

function getMessageType(text) {
  if (isTP2(text)) return "TP2";
  if (isTP1(text)) return "TP1";
  if (isBreakeven(text)) return "BREAKEVEN";
  if (isBreakevenStop(text)) return "BREAKEVEN_STOP";
  if (isInitialStop(text)) return "INITIAL_STOP";
  if (isEntry(text)) return "ENTRY";
  return "OTHER";
}

function isValidMessage(text) {
  if (!text || text.trim().length === 0) return false;
  const hasTradingKeywords = /(品种|方向|开仓|止损|TP1|TP2|保本|盈利|胜率|交易次数)/.test(text) || /(TP2达成|TP1达成|已到保本位置|保本止损|初始止损|【开仓】)/.test(text);
  return hasTradingKeywords;
}

function formatForEnglishDiscord(raw) {
  let text = String(raw || "")
    .replace(/\\u[\dA-Fa-f]{4}/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[^\x00-\x7F\u4e00-\u9fa5\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  text = removeDuplicateLines(text);
  const header = "🤖 Infinity Crypto AI 🤖\n\n";
  let body = "";

  const symbol = getSymbol(text);
  const rawDirection = getDirection(text);
  const translatedDirection = translateDirection(rawDirection); // 翻译方向并保存到新变量
  const entryFromText = getNum(text, "开仓价格");
  const stopPrice = getNum(text, "止损价格");

  const entryPrice = entryFromText != null ? entryFromText : (symbol && lastEntryBySymbol[symbol] ? lastEntryBySymbol[symbol].entry : null);

  const triggerPrice = getNum(text, "平仓价格") || getNum(text, "触发价格") || getNum(text, "TP1价格") || 
    getNum(text, "TP2价格") || getNum(text, "TP1") || getNum(text, "TP2") || getNum(text, "保本位") || null;

  let profitPercent = extractProfitPctFromText(text);
  
  if (isEntry(text) && symbol && entryFromText != null) {
    lastEntryBySymbol[symbol] = { entry: entryFromText, t: Date.now() };
  }

  const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://nextjs-boilerplate-ochre-nine-90.vercel.app";

  if (isTP2(text)) {
    if (profitPercent == null && entryPrice != null && triggerPrice != null) {
      profitPercent = calcAbsProfitPct(entryPrice, triggerPrice);
    }
    
    body = "🎉 TP2 Reached 🎉\n\n" + `📈 Symbol: ${symbol || "-"}\n\n` + `📊 Direction: ${translatedDirection}\n\n` +  // 使用翻译后的方向
      `💰 Entry Price: ${formatPriceSmart(entryPrice)}\n\n` + (triggerPrice ? `🎯 TP2 Price: ${formatPriceSmart(triggerPrice)}\n\n` : "") + 
      `📈 Profit: ${profitPercent != null ? Math.round(profitPercent) : "-"}%\n\n` + "✅ Position Fully Closed\n\n";

    try {
      const latestPrice = getImagePrice(text, entryPrice);
      const imageUrl = generateImageURL({ 
        status: "TP2", 
        symbol, 
        direction: translatedDirection, // 使用翻译后的方向
        price: latestPrice, 
        entry: entryPrice, 
        profit: profitPercent, 
        BASE 
      });
      console.log("=== FormatForEnglishDiscord Image URL ===");
      console.log("Image URL for message:", imageUrl);
      console.log("Direction used:", translatedDirection);
      console.log("=== End FormatForEnglishDiscord Image URL ===");
      body += `![Trading Chart](${imageUrl})\n\n`;
    } catch (error) {
      console.error("Error generating image:", error);
    }
  } else if (isTP1(text)) {
    if (profitPercent == null && entryPrice != null && triggerPrice != null) {
      profitPercent = calcAbsProfitPct(entryPrice, triggerPrice);
    }
    body = "✨ TP1 Reached ✨\n\n" + `📈 Symbol: ${symbol || "-"}\n\n` + `📊 Direction: ${translatedDirection}\n\n` +  // 使用翻译后的方向
      `💰 Entry Price: ${formatPriceSmart(entryPrice)}\n\n` + (triggerPrice ? `🎯 TP1 Price: ${formatPriceSmart(triggerPrice)}\n\n` : "") + 
      `📈 Profit: ${profitPercent != null ? Math.round(profitPercent) : "-"}%\n\n`;

    try {
      const latestPrice = getImagePrice(text, entryPrice);
      const imageUrl = generateImageURL({ 
        status: "TP1", 
        symbol, 
        direction: translatedDirection, // 使用翻译后的方向
        price: latestPrice, 
        entry: entryPrice, 
        profit: profitPercent, 
        BASE 
      });
      console.log("=== FormatForEnglishDiscord Image URL ===");
      console.log("Image URL for message:", imageUrl);
      console.log("Direction used:", translatedDirection);
      console.log("=== End FormatForEnglishDiscord Image URL ===");
      body += `![Trading Chart](${imageUrl})\n\n`;
    } catch (error) {
      console.error("Error generating image:", error);
    }
  } else if (isBreakeven(text)) {
    const positionInfo = extractPositionInfo(text);
    let actualProfitPercent = extractProfitPctFromText(text);
    if (actualProfitPercent === null && entryPrice !== null && triggerPrice !== null) {
      actualProfitPercent = calcAbsProfitPct(entryPrice, triggerPrice);
    }
    
    body = "🎯 Breakeven Reached 🎯\n\n" + `📈 Symbol: ${symbol || "-"}\n\n` + `📊 Direction: ${translatedDirection}\n\n` +  // 使用翻译后的方向
      `💰 Entry Price: ${formatPriceSmart(entryPrice)}\n\n` + (triggerPrice ? `🎯 Trigger Price: ${formatPriceSmart(triggerPrice)}\n\n` : "") + 
      (positionInfo.position ? `📊 Position: ${positionInfo.position}\n\n` : "") + (positionInfo.leverage ? `⚖️ Leverage: ${positionInfo.leverage}\n\n` : "") + 
      (actualProfitPercent !== null ? `📈 Profit: ${actualProfitPercent.toFixed(2)}%\n\n` : "") + "⚠️ Move stop loss to entry (breakeven)\n\n";

    try {
      const latestPrice = getImagePrice(text, entryPrice);
      const imageUrl = generateImageURL({ 
        status: "BREAKEVEN", 
        symbol, 
        direction: translatedDirection, // 使用翻译后的方向
        price: latestPrice, 
        entry: entryPrice, 
        profit: actualProfitPercent, 
        BASE 
      });
      body += `![Trading Chart](${imageUrl})\n\n`;
    } catch (error) {
      console.error("Error generating image:", error);
    }
  } else if (isBreakevenStop(text)) {
    body = "🟡 Breakeven Stop Triggered 🟡\n\n" + `📈 Symbol: ${symbol || "-"}\n\n` + `📊 Direction: ${translatedDirection}\n\n` +  // 使用翻译后的方向
      `💰 Entry Price: ${formatPriceSmart(entryPrice)}\n\n` + "🔄 System Action: Close for protection\n\n" + "✅ Risk Status: Fully transferred\n\n";
  } else if (isInitialStop(text)) {
    const triggerPrice = getNum(text, "触发价格");
    body = "🔴 Initial Stop Triggered 🔴\n\n" + `📈 Symbol: ${symbol || "-"}\n\n` + `📊 Direction: ${translatedDirection}\n\n` +  // 使用翻译后的方向
      `💰 Entry Price: ${formatPriceSmart(entryPrice)}\n\n` + (triggerPrice ? `🎯 Trigger Price: ${formatPriceSmart(triggerPrice)}\n\n` : "") + 
      "🔄 System Action: Stop loss exited\n\n";
  } else if (isEntry(text)) {
    const days = getNum(text, "回测天数");
    const win = getNum(text, "胜率");
    const trades = getNum(text, "交易次数");
    const adjustedWin = adjustWinRate(win);
    const tp1Price = getNum(text, "TP1");
    const tp2Price = getNum(text, "TP2");
    const breakevenPrice = getNum(text, "保本位");

    body = "✅ Entry Signal ✅\n\n" + "🟢 【Entry】 🟢\n\n" + `📈 Symbol: ${symbol ?? "-"}\n\n` + `📊 Direction: ${translatedDirection}\n\n` +  // 使用翻译后的方向
      `💰 Entry Price: ${formatPriceSmart(entryPrice)}\n\n` + `🛑 Stop Loss: ${formatPriceSmart(stopPrice)}\n\n` + 
      `🎯 Breakeven: ${formatPriceSmart(breakevenPrice)}\n\n` + `🎯 TP1: ${formatPriceSmart(tp1Price)}\n\n` + 
      `🎯 TP2: ${formatPriceSmart(tp2Price)}\n\n` + `📊 Backtest Days: ${days ?? "-"}\n\n` + 
      `📈 Win Rate: ${adjustedWin != null ? adjustedWin.toFixed(2) + "%" : "-"}\n\n` + `🔄 Trade Count: ${trades ?? "-"}\n\n`;
  } else {
    body = toLines(text).replace(/\n/g, "\n\n");
  }

  return simplifyEmojis(header + body);
}

export async function POST(req) {
  try {
    console.log("=== Received TradingView Webhook Request ===");
    const contentType = req.headers.get("content-type") || "";
    let raw;

    if (contentType.includes("application/json")) {
      const json = await req.json();
      raw = typeof json === "string" ? json : json?.message || json?.text || json?.content || JSON.stringify(json || {});
    } else {
      raw = await req.text();
    }

    console.log("Raw request data:", raw.substring(0, 500) + (raw.length > 500 ? "..." : ""));
    let processedRaw = String(raw || "").replace(/\\u[\dA-Fa-f]{4}/g, '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/[^\x00-\x7F\u4e00-\u9fa5\s]/g, '').replace(/\s+/g, ' ').trim();
    console.log("Processed message:", processedRaw);

    if (!isValidMessage(processedRaw)) {
      console.log("Received invalid or empty message, skipping processing");
      return NextResponse.json({ ok: true, skipped: true, reason: "Invalid or empty message" });
    }

    const formattedMessage = formatForEnglishDiscord(processedRaw);
    const messageType = getMessageType(processedRaw);
    console.log("Message type:", messageType);
    console.log("Formatted message preview:", formattedMessage.substring(0, 200) + (formattedMessage.length > 200 ? "..." : ""));

    let imageUrl = null;
    let needImage = false;

    if (isTP1(processedRaw) || isTP2(processedRaw) || isBreakeven(processedRaw)) {
      needImage = true;
      const symbol = getSymbol(processedRaw);
      const rawDirection = getDirection(processedRaw);
      const translatedDirection = translateDirection(rawDirection); // 翻译方向
      const entryPrice = getNum(processedRaw, "开仓价格");
      
      const latestPrice = getImagePrice(processedRaw, entryPrice);
      const profitPercent = extractProfitPctFromText(processedRaw) || (entryPrice && latestPrice ? calcAbsProfitPct(entryPrice, latestPrice) : null);

      let status = "INFO";
      if (isTP1(processedRaw)) status = "TP1";
      if (isTP2(processedRaw)) status = "TP2";
      if (isBreakeven(processedRaw)) status = "BREAKEVEN";

      const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://nextjs-boilerplate-ochre-nine-90.vercel.app";
      imageUrl = generateImageURL({ 
        status, 
        symbol, 
        direction: translatedDirection, // 使用翻译后的方向
        price: latestPrice, 
        entry: entryPrice, 
        profit: profitPercent, 
        BASE 
      });
      console.log("Generated image URL:", imageUrl);
    }

    console.log("=== Starting parallel message sending ===");
    const [dingtalkResult, kookResult, discordResult] = await Promise.allSettled([
      (async () => {
        console.log("Starting DingTalk send...");
        if (USE_RELAY_SERVICE) {
          console.log("Using relay service to send message to DingTalk...");
          const rawDirection = getDirection(processedRaw);
          const translatedDirection = translateDirection(rawDirection); // 翻译方向
          
          const relayPayload = {
            message: formattedMessage, 
            needImage, 
            imageParams: imageUrl ? {
              status: messageType, 
              symbol: getSymbol(processedRaw), 
              direction: translatedDirection, // 使用翻译后的方向
              price: getImagePrice(processedRaw, getNum(processedRaw, "开仓价格")), 
              entry: getNum(processedRaw, "开仓价格"),
              profit: extractProfitPctFromText(processedRaw)
            } : null, 
            dingtalkWebhook: DINGTALK_WEBHOOK
          };
          console.log("Relay service request payload:", relayPayload);
          const relayResponse = await fetch(RELAY_SERVICE_URL, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(relayPayload) 
          });
          const relayData = await relayResponse.json();
          console.log("Relay service response:", relayData);
          if (!relayData.success) throw new Error(relayData.error || "Relay service returned error");
          return { ok: true, relayData, method: "relay" };
        } else {
          console.log("Direct send to DingTalk...");
          const markdown = { 
            msgtype: "markdown", 
            markdown: { 
              title: "Trading Notification", 
              text: formattedMessage 
            }, 
            at: { isAtAll: false } 
          };
          console.log("Message content:", markdown.markdown.text);
          const resp = await fetch(DINGTALK_WEBHOOK, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(markdown) 
          });
          const data = await resp.json().catch(() => ({}));
          console.log("DingTalk response:", data);
          return { ok: true, dingTalk: data, method: "direct" };
        }
      })(),
      (async () => { 
        console.log("Starting KOOK send..."); 
        return await sendToKook(formattedMessage, processedRaw, messageType, imageUrl); 
      })(),
      (async () => { 
        console.log("Starting Discord send..."); 
        return await sendToDiscord(formattedMessage, processedRaw, messageType, imageUrl); 
      })()
    ]);

    const results = {
      dingtalk: dingtalkResult.status === 'fulfilled' ? dingtalkResult.value : { error: dingtalkResult.reason?.message },
      kook: kookResult.status === 'fulfilled' ? kookResult.value : { error: kookResult.reason?.message },
      discord: discordResult.status === 'fulfilled' ? discordResult.value : { error: discordResult.reason?.message }
    };

    console.log("=== Final send results ===");
    console.log("DingTalk result:", results.dingtalk);
    console.log("KOOK result:", results.kook);
    console.log("Discord result:", results.discord);

    return NextResponse.json({ 
      ok: true, 
      results, 
      method: USE_RELAY_SERVICE ? "relay" : "direct" 
    });
  } catch (e) {
    console.error("Error processing request:", e);
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { 
      status: 500 
    });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "OK", 
    message: "Infinity Crypto AI Trading Webhook is running",
    timestamp: new Date().toISOString()
  });
}
