/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { ZKH_PRODUCTS_CATALOG } from "./src/data/products";
import { RFQInquiry, ZaloLog, ZaloConfig, AIAnalysisResult } from "./src/types";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up body parsing limits for Base64 image payload transfers
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Lazy initializer for the Gemini SDK Client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm khóa trong tab Thao tác/Secrets ở AI Studio.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// In-Memory Database Stores
let inquiries: RFQInquiry[] = [
  {
    id: "rfq-901",
    customerName: "Nguyễn Văn Hùng",
    phone: "0912345678",
    address: "Công ty Cơ khí Thành Công, Lô B2 KCN Tân Bình, Quận Tân Phú, TP.HCM",
    taxCode: "0314567890",
    quantity: 100,
    notes: "Cần báo giá gấp loại này chịu nhiệt tốt, giao trong tuần sau tại xưởng cơ khí.",
    imageUrl: "https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&w=600&q=80",
    aiAnalysis: {
      productName: "Bu lông lục giác ngoài Inox 304 M10x50",
      category: "Kim khí & Bu lông",
      specs: "Ren thô M10, chiều dài ren 50mm, vật liệu thép không gỉ cán nguội Inox 304, Tiêu chuẩn DIN 933",
      confidence: 95,
      equivalentCode: "ZKH-BL-201",
      suggestions: [ZKH_PRODUCTS_CATALOG[0], ZKH_PRODUCTS_CATALOG[1]]
    },
    status: "quoting",
    assignedStaff: "Lê Minh Tuấn",
    createdAt: "2026-06-19T10:30:00Z"
  },
  {
    id: "rfq-902",
    customerName: "Trần Thị Lan",
    phone: "0987654321",
    address: "Xưởng cơ khí chế tạo máy Đại Nam, 45 Đường số 8, Phường Bình Hưng Hòa B, Bình Tân, TP.HCM",
    taxCode: "",
    quantity: 50,
    notes: "Kiểm tra xem có sẵn kính bảo hộ chống đọng sương chất lượng cao không, sếp cần xem mẫu trước.",
    imageUrl: "https://images.unsplash.com/photo-1596701062351-8c2c14d1fcd9?auto=format&fit=crop&w=600&q=80",
    aiAnalysis: {
      productName: "Kính bảo hộ chống đọng sương HoneyWell A700",
      category: "Thiết bị bảo hộ",
      specs: "Mắt kính nhựa Polycarbonate chịu va đập tốt chống xước, chống đọng sương, lọc UV 99.9%",
      confidence: 90,
      equivalentCode: "ZKH-BH-702",
      suggestions: [ZKH_PRODUCTS_CATALOG[7]]
    },
    status: "new",
    assignedStaff: "Chưa phân công",
    createdAt: "2026-06-19T15:45:00Z"
  }
];

let zaloLogs: ZaloLog[] = [
  {
    id: "log-initial-1",
    timestamp: "2026-06-19T10:31:00Z",
    inquiryId: "rfq-901",
    payload: {
      text: `📩 **YÊU CẦU TÌM SẢN PHẨM BẰNG HÌNH ẢNH**\n\n👤 **Khách hàng**: Nguyễn Văn Hùng\n📞 **SĐT**: 0912345678\n📍 **Địa chỉ**: Công ty Cơ khí Thành Công, Lô B2 KCN Tân Bình\n📦 **Số lượng**: 100\n\n🔍 **AI Quy đổi**:\n- **Sản phẩm**: Bu lông lục giác ngoài Inox 304 M10x50`
    },
    status: "simulated"
  }
];

let zaloConfig: ZaloConfig = {
  webhookUrl: "",
  isEnabled: false
};

// Zalo formatting helper
function buildZaloPayload(inquiry: RFQInquiry) {
  const ai = inquiry.aiAnalysis;
  const aiSection = ai
    ? `- Tên sản phẩm: ${ai.productName}\n- Nhóm hàng: ${ai.category}\n- Thông số: ${ai.specs}\n- Mức độ khớp: ${ai.confidence}%${ai.equivalentCode ? `\n- Mã tương đương: ${ai.equivalentCode}` : ""}`
    : "Không nhận diện được";

  const messageText = `📩 YÊU CẦU TÌM SẢN PHẨM BẰNG HÌNH ẢNH (ZALO)

👤 Khách hàng/Công ty: ${inquiry.customerName}
📞 SĐT/Zalo: ${inquiry.phone}
📍 Địa chỉ: ${inquiry.address}
🧾 MST: ${inquiry.taxCode || "Không có"}
📦 Số lượng cần mua: ${inquiry.quantity}
📝 Ghi chú: ${inquiry.notes || "Không có"}

🔍 AI nhận diện:
${aiSection}

🖼 Ảnh sản phẩm:
${inquiry.imageUrl.startsWith("data:") ? "https://zkh.com.vn (Ảnh Base64)" : inquiry.imageUrl}`;

  return {
    text: messageText,
    inquiryId: inquiry.id
  };
}

// Zalo Notification triggers
async function sendZaloNotification(inquiry: RFQInquiry) {
  const payload = buildZaloPayload(inquiry);

  if (!zaloConfig.isEnabled || !zaloConfig.webhookUrl) {
    // Generate simulated log
    zaloLogs.unshift({
      id: "log-" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      inquiryId: inquiry.id,
      payload,
      status: "simulated"
    });
    return;
  }

  try {
    const res = await fetch(zaloConfig.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      zaloLogs.unshift({
        id: "log-" + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        inquiryId: inquiry.id,
        payload,
        status: "success"
      });
    } else {
      const errorText = await res.text();
      zaloLogs.unshift({
        id: "log-" + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        inquiryId: inquiry.id,
        payload,
        status: "failed",
        error: `Server responded with status ${res.status}: ${errorText}`
      });
    }
  } catch (err: any) {
    zaloLogs.unshift({
      id: "log-" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      inquiryId: inquiry.id,
      payload,
      status: "failed",
      error: err.message || "Lỗi mạng hoặc không thể phản hồi"
    });
  }
}

// ------ API ENDPOINTS ------

// Local Database Retrieval
app.get("/api/products", (req, res) => {
  res.json(ZKH_PRODUCTS_CATALOG);
});

// Zalo Admin Settings Operations
app.get("/api/zalo/config", (req, res) => {
  res.json(zaloConfig);
});

app.post("/api/zalo/config", (req, res) => {
  const { webhookUrl, isEnabled } = req.body;
  zaloConfig.webhookUrl = webhookUrl || "";
  zaloConfig.isEnabled = !!isEnabled;
  res.json({ message: "Đã cập nhật cấu hình Zalo thành công!", config: zaloConfig });
});

app.get("/api/zalo/logs", (req, res) => {
  res.json(zaloLogs);
});

app.post("/api/zalo/test", async (req, res) => {
  const mockInquiry: RFQInquiry = {
    id: "rfq-test",
    customerName: "Khách Hàng Thử Nghiệm",
    phone: "0999999999",
    address: "Văn phòng ZKH Hà Nội, Việt Nam",
    taxCode: "0102030405",
    quantity: 5,
    notes: "Tin nhắn kiểm tra kết nối Webhook kênh Zalo nội bộ.",
    imageUrl: "https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&w=600&q=80",
    aiAnalysis: {
      productName: "Mẫu Thử Nghiệm Kết Nối Webhook",
      category: "Thiết bị đo lường",
      specs: "Trạng thái liên lạc: OK, Giao thức truyền tin: Zalo Webhook",
      confidence: 99,
      equivalentCode: "TEST-SKU-999",
      suggestions: [ZKH_PRODUCTS_CATALOG[5]]
    },
    status: "new",
    assignedStaff: "Hệ thống tự động",
    createdAt: new Date().toISOString()
  };

  const payload = buildZaloPayload(mockInquiry);

  if (!zaloConfig.webhookUrl) {
    return res.status(400).json({
      error: "Vui lòng nhập URL Webhook Zalo trước khi gửi thử nghiệm."
    });
  }

  try {
    const response = await fetch(zaloConfig.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      zaloLogs.unshift({
        id: "log-" + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        inquiryId: "rfq-test",
        payload,
        status: "success"
      });
      return res.json({ success: true, message: "Gửi webhook Zalo thành công!" });
    } else {
      const errorText = await response.text();
      const errLog: ZaloLog = {
        id: "log-" + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        inquiryId: "rfq-test",
        payload,
        status: "failed",
        error: `Máy chủ Zalo báo lỗi ${response.status}: ${errorText}`
      };
      zaloLogs.unshift(errLog);
      return res.status(500).json({
        success: false,
        error: `Máy chủ báo lỗi ${response.status}: ${errorText}`
      });
    }
  } catch (err: any) {
    const errLog: ZaloLog = {
      id: "log-" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      inquiryId: "rfq-test",
      payload,
      status: "failed",
      error: err.message
    };
    zaloLogs.unshift(errLog);
    return res.status(500).json({ success: false, error: err.message || "Lỗi mạng kết nối Zalo" });
  }
});

// AI Customer Upload Analysis
app.post("/api/analyze-image", async (req, res) => {
  const { imageBase64, mimeType } = req.body;

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: "Phải cung cấp dữ liệu hình ảnh (imageBase64) và định dạng (mimeType)." });
  }

  try {
    const ai = getGeminiClient();

    // Prepare image format according to Gemini SDK guidelines - split from data URI safely
    const base64DataOnly = imageBase64.includes(",") 
      ? imageBase64.split(",")[1] 
      : imageBase64;

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64DataOnly,
      },
    };

    // Formulate a clean Vietnamese prompt with context about industrial MRO parts
    const textPart = {
      text: `Bạn là trợ lý AI chuyên gia nhận diện vật tư công nghiệp (MRO) tại Việt Nam cho sàn thương mại điện tử zkh.com.vn.
      Nhiệm vụ của bạn là phân tích hình ảnh sản phẩm công nghiệp hoặc dụng cụ được tải lên và sinh thông tin nhận diện chính xác nhất.
      Duyệt chọn một trong các nhóm ngành hàng phù hợp nhất sau đây:
      - 'Kim khí & Bu lông'
      - 'Vòng bi & Truyền động'
      - 'Dụng cụ cầm tay'
      - 'Dụng cụ điện'
      - 'Thiết bị đo lường'
      - 'Thiết bị bảo hộ'

      Hãy đối soát thật kỹ với danh sách mã sản phẩm sẵn có sau đây để tìm sản phẩm quy đổi chính xác hoặc sản phẩm đề xuất (suggestions) tương thích tối đa 3 ID:
      - SKU 'ZKH-BL-201' đại diện "Bu lông lục giác ngoài Inox 304 M10x50"
      - SKU 'ZKH-BL-202' đại diện "Đai ốc lục giác Inox 201/304 M10"
      - SKU 'ZKH-BL-203' đại diện "Thanh ren mạ kẽm điện phân suốt M12x1000mm"
      - SKU 'ZKH-BL-204' đại diện "Vít bắn tôn tự khoan đầu lục giác xi mạ kẽm M4.8x25"
      - SKU 'ZKH-VB-301' đại diện "Vòng bi cầu một dãy SKF 6204-2Z"
      - SKU 'ZKH-VB-302' đại diện "Gối đỡ vòng bi vuông bằng gang đúc ASAHI UCP205"
      - SKU 'ZKH-VB-303' đại diện "Dây curoa truyền tải răng đôi răng dọc Mitsuboshi S8M-1000"
      - SKU 'ZKH-DC-401' đại diện "Bộ cờ lê vòng miệng Kingtony 8-24mm (14 chi tiết)"
      - SKU 'ZKH-DC-402' đại diện "Tua vít hai đầu 2 cánh và bake Stanley PH2x100mm"
      - SKU 'ZKH-DC-403' đại diện "Kìm răng kết hợp đa năng cách điện 1000V Total THT11506"
      - SKU 'ZKH-DE-501' đại diện "Máy khoan búa bê tông cầm tay Bosch GBH 2-24 DRE"
      - SKU 'ZKH-DE-502' đại diện "Máy mài góc cầm tay Makita 9553B chính hãng"
      - SKU 'ZKH-DE-503' đại diện "Máy siết lực bu lông dùng pin Dewalt DCF899HP2"
      - SKU 'ZKH-DL-601' đại diện "Thước cặp điện tử chống nước Mitutoyo 500-196-30"
      - SKU 'ZKH-DL-602' đại diện "Thước cuộn thép bọc nhựa chống va đập Stanley 30-496 (5m)"
      - SKU 'ZKH-DL-603' đại diện "Đồng hồ đo điện vạn năng số tự động hiển thị Fluke 15B+"
      - SKU 'ZKH-BH-701' đại diện "Mặt nạ phòng chống khói bụi và hóa chất 3M 6200 chính hãng"
      - SKU 'ZKH-BH-702' đại diện "Kính bảo hộ chống đọng sương HoneyWell A700 chính hãng"
      - SKU 'ZKH-BH-703' đại diện "Găng tay dệt sợi chống cắt rách đứt Ansell HyFlex 11-727"
      - SKU 'ZKH-BH-704' đại diện "Giày thể thao bảo hộ mũi sắt Safety Jogger Raptor S1P"

      Hãy đưa ra dự đoán tốt nhất của bạn dưới định dạng JSON theo đúng schema được cung cấp.`,
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: {
              type: Type.STRING,
              description: "Tên chi tiết bằng tiếng Việt của sản phẩm vật tư hoặc dụng cụ công nghiệp được ảnh chụp.",
            },
            category: {
              type: Type.STRING,
              description: "Tên nhóm ngành hàng tương ứng tốt nhất từ danh sách gợi ý.",
            },
            specs: {
              type: Type.STRING,
              description: "Các thông số kỹ thuật, vật liệu chế tạo, tiêu chuẩn hoặc kích thước dự đoán được ngăn cách bởi dấu phẩy.",
            },
            confidence: {
              type: Type.INTEGER,
              description: "Mức độ tự tin chính xác của phán đoán (ví dụ từ 65 đến 98 %).",
            },
            equivalentCode: {
              type: Type.STRING,
              description: "Mã SKU có sẵn nào gần giống hoặc tương đương nhất (Ví dụ: 'ZKH-BL-201'...). Nếu không có thì bỏ trống.",
            },
            suggestedSkuIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Danh sách chứa tối đa 3 ID mã sản phẩm tương tự từ danh sách cung cấp (ví dụ: ['ZKH-BL-201', 'ZKH-BL-202']...) sắp xếp theo độ tương đồng.",
            }
          },
          required: ["productName", "category", "specs", "confidence", "suggestedSkuIds"]
        }
      }
    });

    const parsedData = JSON.parse(response.text?.trim() || "{}");

    // Match with actual database objects to return complete detailed structures
    const matchedSuggestions = ZKH_PRODUCTS_CATALOG.filter(prod => 
      parsedData.suggestedSkuIds?.includes(prod.sku) || prod.sku === parsedData.equivalentCode
    );

    // Fallback if no direct match was selected but we want to provide something helpful
    if (matchedSuggestions.length === 0) {
      // Find category overlap
      const catMatches = ZKH_PRODUCTS_CATALOG.filter(prod => prod.category === parsedData.category);
      matchedSuggestions.push(...catMatches.slice(0, 2));
    }

    const finalResult: AIAnalysisResult = {
      productName: parsedData.productName || "Sản phẩm công nghiệp chưa xác định",
      category: parsedData.category || "Vật tư & Thiết bị khác",
      specs: parsedData.specs || "Không rõ thông số chi tiết",
      confidence: parsedData.confidence || 70,
      equivalentCode: parsedData.equivalentCode || undefined,
      suggestions: matchedSuggestions
    };

    res.json(finalResult);

  } catch (error: any) {
    console.error("Gemini Vision AI Analysis Error: ", error);
    res.status(500).json({ error: error.message || "Yêu cầu nhận diện bằng AI thất bại." });
  }
});

// RFQ Customer / Admin Operations
app.get("/api/inquiries", (req, res) => {
  res.json(inquiries);
});

app.post("/api/inquiries", async (req, res) => {
  const { customerName, phone, address, taxCode, quantity, notes, imageUrl, aiAnalysis } = req.body;

  if (!customerName || !phone || !address || !quantity) {
    return res.status(400).json({ error: "Thiếu thông tin bắt buộc: tên, số điện thoại, địa chỉ và số lượng." });
  }

  const newInquiry: RFQInquiry = {
    id: "rfq-" + Math.random().toString(36).substr(2, 9),
    customerName,
    phone,
    address,
    taxCode: taxCode || "",
    quantity: Number(quantity),
    notes: notes || "",
    imageUrl: imageUrl || "https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?auto=format&fit=crop&w=600&q=80",
    aiAnalysis: aiAnalysis || null,
    status: "new",
    assignedStaff: "Chưa phân công",
    createdAt: new Date().toISOString()
  };

  inquiries.unshift(newInquiry);

  // Dispatch Zalo Notification automatically or log simulation
  await sendZaloNotification(newInquiry);

  res.status(201).json({ message: "Yêu cầu báo giá của bạn đã được gửi đi thành công!", inquiry: newInquiry });
});

app.patch("/api/inquiries/:id", (req, res) => {
  const { id } = req.params;
  const { status, assignedStaff } = req.body;

  const inquiry = inquiries.find(item => item.id === id);

  if (!inquiry) {
    return res.status(404).json({ error: "Không tìm thấy yêu cầu báo giá." });
  }

  if (status) inquiry.status = status;
  if (assignedStaff) inquiry.assignedStaff = assignedStaff;

  res.json({ message: "Đã cập nhật yêu cầu báo giá!", inquiry });
});

app.delete("/api/inquiries/:id", (req, res) => {
  const { id } = req.params;
  const index = inquiries.findIndex(item => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy yêu cầu báo giá để xóa." });
  }

  inquiries.splice(index, 1);
  res.json({ message: "Đã xóa yêu cầu thành công!" });
});


// Global error handling middleware to ensure we always return JSON
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global Server Error Caught:", err);
  res.status(err.status || 500).json({
    error: err.message || "Sự cố nội bộ từ máy chủ sản xuất."
  });
});


// Configure Vite middleware in development or static folder in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Fullstack Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
