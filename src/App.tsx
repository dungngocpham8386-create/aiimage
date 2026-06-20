/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Image as ImageIcon, Send, CheckCircle, Clock, AlertCircle, X, Check, 
  Loader, Briefcase, Layers, Settings, Shield, Search, Download, RefreshCw, 
  ExternalLink, FileText, Trash2, Users, MapPin, User, Phone, Activity, ChevronRight, CheckSquare, Copy,
  ZoomIn, ZoomOut, RotateCw, HelpCircle
} from 'lucide-react';
import { Product, AIAnalysisResult, RFQInquiry, ZaloLog, ZaloConfig } from './types';
import { Language, TRANSLATIONS } from './data/translations';

export default function App() {
  // Localization state
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('lang') as Language) || 'vi');
  const t = TRANSLATIONS[lang];

  const changeLanguage = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  // Tabs: 'customer' or 'admin'
  const [activeTab, setActiveTab] = useState<'customer' | 'admin'>('customer');
  
  // Custom theme mode
  const [accentColor, setAccentColor] = useState<string>('emerald'); // emerald, blue, orange, slate

  // --- Customer State ---
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('');
  const [aiStatus, setAiStatus] = useState<'idle' | 'reading' | 'analyzing' | 'matching' | 'done' | 'error'>('idle');
  const [aiErrorMsg, setAiErrorMsg] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [copiedSpecs, setCopiedSpecs] = useState(false);
  
  // Lightbox & image zoom control states
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [rotateAngle, setRotateAngle] = useState(0);

  const handleCopySpecs = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSpecs(true);
    setTimeout(() => setCopiedSpecs(false), 2000);
  };

  // Form states
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');
  const [successInquiry, setSuccessInquiry] = useState<RFQInquiry | null>(null);

  // --- Admin State ---
  const [inquiries, setInquiries] = useState<RFQInquiry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isRefreshingAdmin, setIsRefreshingAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');

  // Zalo Config Settings on Admin Tab
  const [weChatUrl, setWeChatUrl] = useState('');
  const [weChatEnabled, setWeChatEnabled] = useState(false);
  const [weChatLogs, setWeChatLogs] = useState<ZaloLog[]>([]);
  const [isTestingWeChat, setIsTestingWeChat] = useState(false);
  const [weChatFeedback, setWeChatFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and load catalogs & inquiries
  useEffect(() => {
    fetchInquiries();
    fetchWeChatConfig();
    fetchWeChatLogs();
  }, []);

  // Keyboard shortcut to close Zoom lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      }
    };
    if (isLightboxOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLightboxOpen]);

  const fetchInquiries = async () => {
    setIsRefreshingAdmin(true);
    setAdminError('');
    try {
      const res = await fetch('/api/inquiries');
      if (!res.ok) throw new Error('Không thể tải danh sách yêu cầu báo giá.');
      const data = await res.json();
      setInquiries(data);
    } catch (err: any) {
      setAdminError(err.message || 'Lỗi tải cơ sở dữ liệu');
    } finally {
      setIsRefreshingAdmin(false);
    }
  };

  const fetchWeChatConfig = async () => {
    try {
      const res = await fetch('/api/zalo/config');
      if (res.ok) {
        const data = await res.json() as ZaloConfig;
        setWeChatUrl(data.webhookUrl);
        setWeChatEnabled(data.isEnabled);
      }
    } catch (err) {
      console.error('Không tải được cài đặt Zalo:', err);
    }
  };

  const fetchWeChatLogs = async () => {
    try {
      const res = await fetch('/api/zalo/logs');
      if (res.ok) {
        const data = await res.json();
        setWeChatLogs(data);
      }
    } catch (err) {
      console.error('Không tải được nhật ký Zalo:', err);
    }
  };

  // Image Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng tải lên một tệp hình ảnh hợp lệ (PNG, JPG, WEBP, GIF)');
      return;
    }

    // Limit client side representation size
    if (file.size > 10 * 1024 * 1024) {
      alert('Kích thước ảnh quá lớn. Vui lòng tải ảnh dưới 10MB.');
      return;
    }

    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      setSelectedImage(base64String);
      // Automatically trigger AI analysis
      analyzeSelectedImage(base64String, file.type);
    };
    reader.onerror = () => {
      alert('Có lỗi xảy ra khi đọc file ảnh.');
    };
    reader.readAsDataURL(file);
  };

  // Drag over detection helpers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Call Server-Side AI Vision with progress steps
  const analyzeSelectedImage = async (base64Payload: string, typeStr: string) => {
    setAiStatus('reading');
    setAiErrorMsg('');
    setAnalysisResult(null);

    // Give visual animation feel to simulated steps
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    
    try {
      await sleep(1000); // Simulated Step "Processing File"
      setAiStatus('analyzing');
      
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Payload,
          mimeType: typeStr
        }),
      });

      if (!response.ok) {
        let errMsg = '';
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            const errorJSON = await response.json();
            errMsg = errorJSON.error || errorJSON.message || 'Yêu cầu robot Gemini Vision đọc ảnh thất bại.';
          } catch {
            errMsg = 'Lỗi máy chủ phản hồi không đúng định dạng.';
          }
        } else {
          const textError = await response.text();
          console.error("Non-JSON Server Response:", textError);
          if (textError.includes("GEMINI_API_KEY") || textError.includes("apiKey") || textError.includes("API Key")) {
            errMsg = 'Khóa API Gemini (GEMINI_API_KEY) chưa được thiết lập chính xác. Vui lòng kiểm tra tab Settings -> Secrets trong AI Studio và cấu hình khóa mới.';
          } else {
            errMsg = `Lỗi máy chủ (${response.status}): Không thể xử lý yêu cầu phân tích ảnh. Vui lòng kiểm tra khóa GEMINI_API_KEY trong cấu hình Secrets.`;
          }
        }
        throw new Error(errMsg);
      }

      // Check content-type of success response
      const successContentType = response.headers.get('content-type');
      if (!successContentType || !successContentType.includes('application/json')) {
        const rawText = await response.text();
        console.error("Success endpoint returned non-JSON product payload:", rawText);
        throw new Error('Sự cố hệ thống: Phản hồi thành công từ máy chủ không mang định dạng JSON.');
      }

      const parsedResult: AIAnalysisResult = await response.json();
      
      setAiStatus('matching');
      await sleep(1200); // Simulated Step 3 Match checking with ZKH
      
      setAnalysisResult(parsedResult);
      setAiStatus('done');
    } catch (err: any) {
      console.error(err);
      setAiErrorMsg(err.message || 'Lỗi bất ngờ xảy ra khi AI nhận diện hình ảnh của bạn.');
      setAiStatus('error');
    }
  };

  // Reset Customer Form
  const resetCustomerProcess = () => {
    setSelectedImage(null);
    setImageMime('');
    setAiStatus('idle');
    setAnalysisResult(null);
    setSubmitStatus('idle');
    setSuccessInquiry(null);
  };

  // Submit Inquiry RFQ Form
  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim() || !address.trim() || quantity <= 0) {
      setSubmitError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }

    setSubmitStatus('submitting');
    setSubmitError('');

    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName,
          phone,
          address,
          taxCode,
          quantity,
          notes,
          imageUrl: selectedImage,
          aiAnalysis: analysisResult
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Máy chủ không thể lưu thông tin yêu cầu báo giá của bạn.');
      }

      const result = await response.json();
      setSuccessInquiry(result.inquiry);
      setSubmitStatus('success');
      
      // Update our queries cache
      fetchInquiries();
      fetchWeChatLogs();
    } catch (err: any) {
      setSubmitError(err.message || 'Gặp sự cố khi gửi dữ liệu báo giá.');
      setSubmitStatus('error');
    }
  };

  // Admin Actions
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setInquiries(prev => prev.map(item => item.id === id ? { ...item, status: newStatus as any } : item));
      }
    } catch (err) {
      console.error('Không cập nhật được trạng thái:', err);
    }
  };

  const handleUpdateStaff = async (id: string, staffName: string) => {
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedStaff: staffName })
      });
      if (res.ok) {
        setInquiries(prev => prev.map(item => item.id === id ? { ...item, assignedStaff: staffName } : item));
      }
    } catch (err) {
      console.error('Không phân công được nhân viên:', err);
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn yêu cầu báo giá này không?')) return;
    try {
      const res = await fetch(`/api/inquiries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setInquiries(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error('Xóa thất bại:', err);
    }
  };

  // Submit Zalo Configuration Changes
  const handleSaveWeChatConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setWeChatFeedback(null);
    try {
      const res = await fetch('/api/zalo/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: weChatUrl, isEnabled: weChatEnabled })
      });
      if (res.ok) {
        setWeChatFeedback({ type: 'success', message: 'Lưu cấu hình Webhook Nhóm Zalo mới thành công!' });
        fetchWeChatConfig();
      } else {
        const err = await res.json();
        setWeChatFeedback({ type: 'error', message: err.error || 'Cập nhật cấu hình thất bại.' });
      }
    } catch (err: any) {
      setWeChatFeedback({ type: 'error', message: err.message || 'Không kết nối được server.' });
    }
  };

  // Zalo Connection check trigger
  const handleTestWeChat = async () => {
    if (!weChatUrl) {
      setWeChatFeedback({ type: 'error', message: 'Vui lòng cung cấp link webhook Zalo trước khi gửi thử nghiệm.' });
      return;
    }
    setIsTestingWeChat(true);
    setWeChatFeedback(null);
    try {
      const res = await fetch('/api/zalo/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setWeChatFeedback({ type: 'success', message: 'Đã bắn thông báo thử nghiệm vào Nhóm Zalo thành công! Xem nhật ký.' });
        fetchWeChatLogs();
      } else {
        setWeChatFeedback({ type: 'error', message: data.error || 'Yêu cầu kiểm thử Zalo trả về lỗi.' });
      }
    } catch (err: any) {
      setWeChatFeedback({ type: 'error', message: err.message || 'Gặp sự cố mạng khi phát Webhook.' });
    } finally {
      setIsTestingWeChat(false);
    }
  };

  // Excel (CSV Format) Export Mechanism
  const handleExportCSV = () => {
    if (inquiries.length === 0) {
      alert('Không có dữ liệu yêu cầu nào để xuất tương ứng.');
      return;
    }

    // Creating robust CSV content header (UTF-8 with BOM for Excel Vietnamese compatibility)
    let csvContent = '\uFEFF'; 
    csvContent += 'Mã Yêu Cầu,Ngày Tạo,Khách Hàng,Số Điện Thoại,Địa Chỉ,MST,Số Lượng,Sản Phẩm AI Nhận Diện,Nhóm Ngành Hàng,Độ Chính Xác,Ghi Chú,Nhân Viên Phụ Trách,Trạng Thái\n';

    inquiries.forEach(inq => {
      const cleanName = (inq.customerName || '').replace(/"/g, '""');
      const cleanAddress = (inq.address || '').replace(/"/g, '""');
      const cleanNotes = (inq.notes || '').replace(/"/g, '""');
      const cleanAiProduct = (inq.aiAnalysis?.productName || 'Không xác định').replace(/"/g, '""');
      const cleanAiCategory = (inq.aiAnalysis?.category || 'Không rõ').replace(/"/g, '""');
      const cleanStatusStr = inq.status === 'new' ? 'Mới nhận' : inq.status === 'quoting' ? 'Đang báo giá' : inq.status === 'closed' ? 'Đã chốt' : 'Không phù hợp';
      
      csvContent += `"${inq.id}","${inq.createdAt}","${cleanName}","${inq.phone}","${cleanAddress}","${inq.taxCode || ''}","${inq.quantity}","${cleanAiProduct}","${cleanAiCategory}","${inq.aiAnalysis?.confidence || 0}%","${cleanNotes}","${inq.assignedStaff}","${cleanStatusStr}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RFQ_ZKH_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter inquiries listing in Admin
  const filteredInquiries = inquiries.filter(inq => {
    const searchString = `${inq.id} ${inq.customerName} ${inq.phone} ${inq.address} ${inq.aiAnalysis?.productName || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">💎 Mới nhận</span>;
      case 'quoting':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">⚡ Đang báo giá</span>;
      case 'closed':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">✅ Đã chốt</span>;
      case 'unsuitable':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">❌ Không phù hợp</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbfe] text-[#2c3e50] font-sans antialiased flex flex-col transition-colors duration-300">
      
      {/* Dynamic Aesthetic Brand Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo & Product Line Title */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-extrabold text-lg tracking-wider">
              ZKH
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-display font-bold tracking-tight text-slate-900">
                  {t.appTitle}
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest bg-orange-100 text-orange-700">
                  MVP v1.2
                </span>
              </div>
              <p className="text-xs text-slate-500">{t.appSubTitle}</p>
            </div>
          </div>

          {/* Mode Switcher Button and UI Customization Tools */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            
            {/* Language Selection Pill */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/50 shadow-inner">
              <button
                type="button"
                onClick={() => changeLanguage('vi')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  lang === 'vi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tiếng Việt"
              >
                <span>🇻🇳</span>
                <span className="hidden xs:inline">VI</span>
              </button>
              <button
                type="button"
                onClick={() => changeLanguage('zh')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  lang === 'zh' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="简体中文"
              >
                <span>🇨🇳</span>
                <span className="hidden xs:inline">中文</span>
              </button>
            </div>

            {/* Visual Tint Selector */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <span className="text-slate-400 font-medium">{t.layoutLabel}</span>
              <button 
                onClick={() => setAccentColor('emerald')} 
                className={`w-3.5 h-3.5 rounded-full bg-emerald-500 ring-offset-2 hover:scale-110 transition-all ${accentColor === 'emerald' ? 'ring-2 ring-emerald-500' : ''}`}
                title={t.emeraldTheme}
              />
              <button 
                onClick={() => setAccentColor('blue')} 
                className={`w-3.5 h-3.5 rounded-full bg-blue-500 ring-offset-2 hover:scale-110 transition-all ${accentColor === 'blue' ? 'ring-2 ring-blue-500' : ''}`}
                title={t.blueTheme}
              />
              <button 
                onClick={() => setAccentColor('orange')} 
                className={`w-3.5 h-3.5 rounded-full bg-orange-500 ring-offset-2 hover:scale-110 transition-all ${accentColor === 'orange' ? 'ring-2 ring-orange-500' : ''}`}
                title={t.orangeTheme}
              />
            </div>

            {/* Main Tabs Navigation to swap roles */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center w-full sm:w-auto">
              <button
                id="tab-customer"
                onClick={() => setActiveTab('customer')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'customer'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                {t.customerTab}
              </button>
              
              <button
                id="tab-admin"
                onClick={() => setActiveTab('admin')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'admin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Shield className="w-4 h-4" />
                {t.adminTab}
                {inquiries.filter(i => i.status === 'new').length > 0 && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </button>
            </div>
            
          </div>

        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* ========================================= CUSTOMER SECTION ========================================= */}
        {activeTab === 'customer' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Visual Intro banner */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
              <div className="relative z-10 max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-orange-300 text-xs font-semibold backdrop-blur-sm">
                  {t.bannerBadge}
                </div>
                <h2 className="text-2xl sm:text-4xl font-display font-extrabold tracking-tight">
                  {t.bannerTitle}
                </h2>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  {t.bannerDesc}
                </p>
                
                {/* Features Badges */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> {t.badgeFeature1}</span>
                  <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> {t.badgeFeature2}</span>
                  <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-400" /> {t.badgeFeature3}</span>
                </div>
              </div>
            </div>

            {/* Split layout: Image Upload (Left) & Form / AI Suggestion (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Drag & Drop Area */}
              <div className="lg:col-span-5 space-y-6">
                
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                  <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <span className="p-1 rounded bg-slate-100 text-slate-700">1</span>
                    {t.step1Title}
                  </h3>

                  {/* Drag drop dropzone */}
                  <div 
                    onClick={() => {
                      if (!selectedImage) {
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 flex flex-col items-center justify-center min-h-[300px] ${
                      isDragging 
                        ? 'border-orange-500 bg-orange-50/50 cursor-pointer' 
                        : selectedImage 
                          ? 'border-emerald-300 bg-slate-50/20 cursor-default' 
                          : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden" 
                    />

                    {selectedImage ? (
                      <div className="space-y-4 w-full">
                        <div className="relative mx-auto rounded-xl overflow-hidden group max-w-full border border-slate-200 bg-white shadow-inner flex justify-center items-center">
                          <img 
                            src={selectedImage} 
                            alt="Ảnh sản phẩm tải lên" 
                            className="max-h-[240px] w-auto object-contain rounded-lg p-1 transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                          
                          {/* Hover action overlay */}
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all duration-200 flex flex-col sm:flex-row items-center justify-center gap-2 p-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomScale(1);
                                setRotateAngle(0);
                                setIsLightboxOpen(true);
                              }}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                              {lang === 'vi' ? 'Xem chi tiết / Phóng to' : '查看原图 / 放大'}
                            </button>
                            
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                              }}
                              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              {lang === 'vi' ? 'Đổi ảnh khác' : '更换图片'}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            {t.savedToCache}
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setZoomScale(1);
                              setRotateAngle(0);
                              setIsLightboxOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 font-semibold cursor-pointer py-1 px-2 hover:bg-emerald-50 rounded-lg transition-all"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                            {lang === 'vi' ? 'Nhấp để phóng to / Xoay / Kiểm tra độ nét' : '点击放大 / 旋转 / 细节清晰度核验'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                          <Upload className="w-8 h-8 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{t.dragDropText}</p>
                          <p className="text-xs text-slate-400 mt-1">{t.supportFormatText}</p>
                        </div>
                        <div className="inline-block px-3 py-1.5 bg-slate-200/50 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-all">
                          {t.selectFileBtn}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reset button if image uploaded */}
                  {selectedImage && (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={resetCustomerProcess}
                        className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {t.refreshBtn}
                      </button>
                    </div>
                  )}

                  {/* Quick Guide */}
                  <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">{t.uploadTipsTitle}</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>{t.tip1}</li>
                      <li>{t.tip2}</li>
                      <li>{t.tip3}</li>
                    </ul>
                  </div>

                </div>

              </div>

              {/* Right Column: AI Analysis Output & Form */}
              <div className="lg:col-span-7 space-y-6">

                {/* --- Step 2: AI Suggestions Panel --- */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm overflow-hidden relative">
                  
                  {/* Decorative glowing background accent and theme header */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-${accentColor}-500`}></div>

                  <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="p-1 rounded bg-slate-100 text-slate-700">2</span>
                      {t.step2Title}
                    </span>

                    {/* Active State indicators */}
                    {aiStatus === 'reading' && <span className="text-xs text-indigo-600 font-semibold animate-pulse flex items-center gap-1"><Loader className="w-3" /> {t.aiReading}</span>}
                    {aiStatus === 'analyzing' && <span className="text-xs text-blue-600 font-semibold animate-pulse flex items-center gap-1"><Loader className="w-3 animate-spin"/> {t.aiAnalyzing}</span>}
                    {aiStatus === 'matching' && <span className="text-xs text-orange-600 font-semibold animate-pulse flex items-center gap-1"><Loader className="w-3 animate-spin" /> {t.aiMatching}</span>}
                    {aiStatus === 'done' && <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {t.aiCompleted}</span>}
                  </h3>

                  {aiStatus === 'idle' && (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <Layers className="w-12 h-12 mx-auto opacity-30 animate-bounce" />
                      <p className="text-sm">{t.aiIdleFallback}</p>
                    </div>
                  )}

                  {/* Processing / Progress Steps Visual feedback */}
                  {(aiStatus === 'reading' || aiStatus === 'analyzing' || aiStatus === 'matching') && (
                    <div className="py-10 space-y-6">
                      <div className="max-w-xs mx-auto text-center space-y-3">
                        <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-orange-500 animate-spin mx-auto"></div>
                        <p className="font-semibold text-slate-700 text-sm">{t.aiAnalyzing}</p>
                      </div>

                      {/* Horizontal progress indicators */}
                      <div className="grid grid-cols-3 max-w-md mx-auto pt-4 relative">
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
                        
                        <div className="relative z-10 flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            aiStatus !== 'idle' ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-200 text-slate-500'
                          }`}>1</div>
                          <span className="text-[10px] text-slate-600 font-medium mt-1">{t.aiProgress1}</span>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            aiStatus === 'analyzing' || aiStatus === 'matching' ? 'bg-orange-500 text-white shadow-md animate-pulse' : 'bg-slate-200 text-slate-500'
                          }`}>2</div>
                          <span className="text-[10px] text-slate-600 font-medium mt-1">{t.aiProgress2}</span>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            aiStatus === 'matching' ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-200 text-slate-500'
                          }`}>3</div>
                          <span className="text-[10px] text-slate-600 font-medium mt-1">{t.aiProgress3}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Error states and Config instructions */}
                  {aiStatus === 'error' && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-4">
                      <div className="flex gap-2 text-rose-800">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>
                          <p className="font-bold text-sm">{t.aiErrorTitle}</p>
                          <p className="text-xs mt-1 text-rose-700">{aiErrorMsg}</p>
                        </div>
                      </div>
                      
                      {/* Guidance Box on setting keys */}
                      <div className="p-3 bg-white border border-rose-200 rounded-lg text-slate-600 text-xs space-y-2">
                        <p className="font-semibold text-slate-800 flex items-center gap-1 text-[11px] uppercase tracking-wide">
                          {t.aiApiKeyGuideTitle}
                        </p>
                        <p>{t.aiApiKeyGuideDesc}</p>
                      </div>
                    </div>
                  )}

                  {/* Show Results if analyzed successfully */}
                  {aiStatus === 'done' && analysisResult && (
                    <div className="space-y-6">
                      
                      {/* Analysis Header Block */}
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-4">
                        
                        <div className="sm:col-span-8 space-y-1">
                          <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-orange-100 text-orange-800">
                            {analysisResult.category}
                          </span>
                          <h4 className="text-lg font-bold text-slate-900 leading-tight">
                            {analysisResult.productName}
                          </h4>
                          <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                            <span>{t.equivalentProduct}</span>
                            <span className="text-indigo-600 font-bold">{analysisResult.equivalentCode || t.noEquivalent}</span>
                          </p>
                        </div>

                        {/* Visual rating meter circle/pill */}
                        <div className="sm:col-span-4 flex flex-col justify-center items-end border-t sm:border-t-0 sm:border-l border-slate-200/65 pt-3 sm:pt-0 sm:pl-4">
                          <div className="text-right">
                            <span className="text-2xl font-extrabold text-emerald-600 font-mono">
                              {analysisResult.confidence}%
                            </span>
                            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">{t.confidenceRaw}</p>
                          </div>
                          
                          {/* Small confidence badge text */}
                          <div className="mt-1">
                            {analysisResult.confidence >= 90 ? (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-100">{t.confidenceHighlyTrusted}</span>
                            ) : analysisResult.confidence >= 75 ? (
                              <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-100">{t.confidenceFairlyAccurate}</span>
                            ) : (
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{t.confidenceCheckRequired}</span>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Display predicted specifications list */}
                      <div className="space-y-1.5 relative">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                            {t.predictedSpecs}
                          </label>
                          <button
                            type="button"
                            onClick={() => handleCopySpecs(analysisResult.specs)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-orange-600 bg-slate-100/80 hover:bg-orange-50 px-2 py-1 rounded-lg transition-all cursor-pointer shadow-sm border border-slate-200/50"
                            title={t.copyBtn}
                          >
                            {copiedSpecs ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                                <span className="text-emerald-700 font-bold">{t.copiedText}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>{t.copyBtn}</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-700 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                          {analysisResult.specs}
                        </p>
                      </div>

                      {/* Catalog matches suggestions */}
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                          {t.suggestedMatches}
                        </label>

                        {analysisResult.suggestions && analysisResult.suggestions.length > 0 ? (
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                             {analysisResult.suggestions.map((prod) => (
                              <div 
                                key={prod.id}
                                className="border border-slate-200 rounded-xl p-3 bg-white hover:border-orange-300 transition-all flex flex-col justify-between group"
                              >
                                <div className="space-y-2">
                                  {/* Small Card Image */}
                                  <div className="h-28 w-full rounded-lg bg-slate-100 relative overflow-hidden">
                                    <img 
                                      src={prod.imageUrl} 
                                      alt={prod.name} 
                                      className="h-full w-full object-cover rounded-lg group-hover:scale-105 transition-transform"
                                    />
                                    <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900/85 text-white">
                                      {prod.sku}
                                    </span>
                                  </div>

                                  <div className="space-y-1">
                                    <h5 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                                      {prod.name}
                                    </h5>
                                    <p className="text-[10px] text-slate-500 line-clamp-2">
                                      {prod.specs}
                                    </p>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-50 mt-2 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-slate-400">{t.catalogMatches}</span>
                                  <a 
                                    href={prod.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-0.5"
                                  >
                                    {t.seeDetails}
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">{t.noMatches}</p>
                        )}
                      </div>

                    </div>
                  )}

                </div>

                {/* --- Step 3: Information RFQ Confirmation form --- */}
                {selectedImage && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative">
                    <div className={`absolute top-0 left-0 right-0 h-1.5 bg-orange-500`}></div>
                    
                    <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <span className="p-1 rounded bg-slate-100 text-slate-700">3</span>
                      {t.step3Title}
                    </h3>

                    {submitStatus === 'success' && successInquiry ? (
                      <div className="py-8 px-4 text-center space-y-4 animate-scale-up">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                          <CheckCircle className="w-10 h-10" />
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="text-xl font-bold text-slate-900">{t.submitSuccessTitle}</h4>
                          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                            {t.submitSuccessDesc}
                          </p>
                        </div>

                        {/* Confirmation Voucher details */}
                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-left max-w-sm mx-auto text-xs space-y-2 text-slate-700">
                          <p className="flex justify-between"><span>{t.rfqCode}</span> <strong className="font-mono text-indigo-600">{successInquiry.id}</strong></p>
                          <p className="flex justify-between"><span>{t.rfqCustomer}</span> <span>{successInquiry.customerName}</span></p>
                          <p className="flex justify-between"><span>{t.rfqQuantityLabel}</span> <span>{successInquiry.quantity}</span></p>
                          <p className="flex justify-between"><span>{t.rfqAiPrediction}</span> <span className="font-medium text-slate-900 truncate max-w-[200px]">{successInquiry.aiAnalysis?.productName || t.rfqUnknownProduct}</span></p>
                        </div>

                        <button
                          onClick={resetCustomerProcess}
                          className="pt-2 text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 mx-auto font-mono"
                        >
                          {t.anotherPhotoBtn}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleInquirySubmit} className="space-y-4">
                        
                        {/* Split fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          
                          {/* Customer Name */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-700">
                                {t.formCompOrCustName} <span className="text-red-500">*</span>
                              </label>
                              <div className="relative inline-flex items-center group">
                                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-help" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-60 p-2.5 bg-slate-950 border border-slate-800 text-slate-200 text-[11px] font-normal leading-relaxed rounded-lg shadow-xl z-50 pointer-events-none">
                                  <div className="relative">
                                    {lang === 'vi' 
                                      ? 'Nhập họ tên người liên hệ trực tiếp hoặc tên đầy đủ của doanh nghiệp để lưu trữ hồ sơ báo giá.' 
                                      : '请输入直接联系人姓名或公司企业全称，以便归档物料采购报价记录。'}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-950 rotate-45 -mt-1 border-r border-b border-slate-800"></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                <User className="w-4 h-4" />
                              </span>
                              <input 
                                type="text" 
                                required
                                placeholder={t.formCompOrCustPlaceholder}
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                              />
                            </div>
                          </div>

                          {/* Customer Phone */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-700">
                                {t.formPhoneZalo} <span className="text-red-500">*</span>
                              </label>
                              <div className="relative inline-flex items-center group">
                                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-help" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-60 p-2.5 bg-slate-950 border border-slate-800 text-slate-200 text-[11px] font-normal leading-relaxed rounded-lg shadow-xl z-50 pointer-events-none">
                                  <div className="relative">
                                    {lang === 'vi' 
                                      ? 'Số điện thoại có Zalo hoạt động giúp chuyên viên ZKH kết nối nhanh để gửi bảng kê báo giá.' 
                                      : '请提供已开通 Zalo 的手机号码，以便 ZKH 客服极速为您推送量身定制的报价。'}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-950 rotate-45 -mt-1 border-r border-b border-slate-800"></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                <Phone className="w-4 h-4" />
                              </span>
                              <input 
                                type="tel" 
                                required
                                placeholder={t.formPhonePlaceholder}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                              />
                            </div>
                          </div>

                        </div>

                        {/* Split fields Row 2 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          
                          {/* Address */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-700">
                                {t.formAddress} <span className="text-red-500">*</span>
                              </label>
                              <div className="relative inline-flex items-center group">
                                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-help" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-60 p-2.5 bg-slate-950 border border-slate-800 text-slate-200 text-[11px] font-normal leading-relaxed rounded-lg shadow-xl z-50 pointer-events-none">
                                  <div className="relative">
                                    {lang === 'vi' 
                                      ? 'Địa chỉ nhận hàng cụ thể hoặc địa điểm nhà máy sản xuất giúp tính toán chi phí và thời gian giao hàng.' 
                                      : '请填写具体收货地址或加工厂区定位，以便协助核算最佳的物流运费与运输时效。'}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-950 rotate-45 -mt-1 border-r border-b border-slate-800"></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                <MapPin className="w-4 h-4" />
                              </span>
                              <input 
                                type="text"
                                required 
                                placeholder={t.formAddressPlaceholder}
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                              />
                            </div>
                          </div>

                          {/* Tax Code */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <label className="text-xs font-bold text-slate-700">
                                {t.formTaxCode} <span className="text-slate-400 font-normal">{t.formTaxCodeOptional}</span>
                              </label>
                              <div className="relative inline-flex items-center group">
                                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-help" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-60 p-2.5 bg-slate-950 border border-slate-800 text-slate-200 text-[11px] font-normal leading-relaxed rounded-lg shadow-xl z-50 pointer-events-none">
                                  <div className="relative">
                                    {lang === 'vi' 
                                      ? 'Mã số thuế doanh nghiệp hỗ trợ đối soát, lập hồ sơ và xuất hóa đơn GTGT điện tử chuẩn chỉ.' 
                                      : '企业纳税人识别号，用于签署合同及开具正规电子增值税发票时进行对账与核验。'}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-950 rotate-45 -mt-1 border-r border-b border-slate-800"></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                                <FileText className="w-4 h-4" />
                              </span>
                              <input 
                                type="text" 
                                placeholder={t.formTaxCodePlaceholder}
                                value={taxCode}
                                onChange={(e) => setTaxCode(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                              />
                            </div>
                          </div>

                        </div>

                        {/* Quantity controls */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <label className="text-xs font-bold text-slate-700">
                              {t.formQuantity} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative inline-flex items-center group">
                              <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-help" />
                              <div className="absolute bottom-full left-2/3 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2.5 bg-slate-950 border border-slate-800 text-slate-200 text-[11px] font-normal leading-relaxed rounded-lg shadow-xl z-50 pointer-events-none">
                                <div className="relative">
                                  {lang === 'vi' 
                                    ? 'Số lượng thiết bị bạn dự kiến đặt mua. Mua hàng số lượng lớn (bán sỉ) sẽ được hưởng mức chiết khấu MRO thương mại tốt hơn.' 
                                    : '您要采购的配件数量。批量采购可享受更优惠的大宗商业折扣和阶梯价格优惠。'}
                                  <div className="absolute top-full left-1/4 -translate-x-1/2 w-2 h-2 bg-slate-950 rotate-45 -mt-1 border-r border-b border-slate-800"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              required
                              min="1"
                              value={quantity}
                              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                              className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                            <div className="flex gap-1.5">
                              <button 
                                type="button" 
                                onClick={() => setQuantity(5)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded border transition-all ${quantity === 5 ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                              >5</button>
                              <button 
                                type="button" 
                                onClick={() => setQuantity(20)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded border transition-all ${quantity === 20 ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                              >20</button>
                              <button 
                                type="button" 
                                onClick={() => setQuantity(100)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded border transition-all ${quantity === 100 ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                              >100+</button>
                            </div>
                          </div>
                        </div>

                        {/* Notes input */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <label className="text-xs font-bold text-slate-700">
                              {t.formNotes} <span className="text-slate-400 font-normal">{t.formTaxCodeOptional}</span>
                            </label>
                            <div className="relative inline-flex items-center group">
                              <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2.5 bg-slate-950 border border-slate-800 text-slate-200 text-[11px] font-normal leading-relaxed rounded-lg shadow-xl z-50 pointer-events-none">
                                <div className="relative">
                                  {lang === 'vi' 
                                    ? 'Ví dụ: Yêu cầu độ cứng 8.8, xuất xứ Hàn Quốc/Nhật Bản, bản vẽ đi kèm, hoặc thời hạn giao nhận mong muốn.' 
                                    : '示例：可备注所需螺栓抗扭等级（如8.8级）、指定原产地、随附图纸要求或最迟送达时限。'}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-950 rotate-45 -mt-1 border-r border-b border-slate-800"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <textarea 
                            rows={3}
                            placeholder={t.formNotesPlaceholder}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                          ></textarea>
                        </div>

                        {/* Submitter details review checklist */}
                        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1.5 text-xs text-indigo-900">
                          <p className="font-semibold flex items-center gap-1">🛡️ ZKH Zalo Delivery Guaranteed:</p>
                          <p className="text-indigo-800 leading-normal">
                            {lang === 'vi' 
                              ? "Bằng việc gửi đi biểu mẫu, bức ảnh chụp gốc của bạn và kết quả nhận diện AI sẽ tự động được đính kèm vào hồ sơ xử lý báo giá nhằm giúp nhân sự phản hồi chuẩn chỉ nhất."
                              : "通过提交此表单，您的原始设备照片与 AI 提取出的物料规格参数将被直接附录归档，以辅助销售支持团队在15分钟内提供最高精确度的报价。"}
                          </p>
                        </div>

                        {submitError && (
                          <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-800">
                            {submitError}
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={submitStatus === 'submitting'}
                            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all shadow-md shadow-orange-500/10 flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
                          >
                            {submitStatus === 'submitting' ? (
                              <>
                                <Loader className="w-5 h-5 animate-spin" />
                                {t.formSubmitting}
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                {t.formSubmitRfqBtn}
                              </>
                            )}
                          </button>
                        </div>

                      </form>
                    )}

                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        {/* ========================================= ADMIN MANAGEMENT SECTION ========================================= */}
        {activeTab === 'admin' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Quick Overview Stats summary widget list */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{t.adminTotalRfq}</p>
                  <p className="text-xl font-bold text-slate-800">{inquiries.length}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{t.adminQuoting}</p>
                  <p className="text-xl font-bold text-slate-800">
                    {inquiries.filter(i => i.status === 'quoting').length}
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{t.adminClosed}</p>
                  <p className="text-xl font-bold text-slate-800">
                    {inquiries.filter(i => i.status === 'closed').length}
                  </p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{t.adminWechatChannel}</p>
                  <p className="text-xs font-bold text-slate-700 truncate max-w-[140px]">
                    {weChatEnabled ? t.wechatLive : t.wechatSim}
                  </p>
                </div>
              </div>

            </div>

            {/* Split screen: Main list filters (Left 8-cols) & WeChat Settings (Right 4-cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Side: Table & Inquiries database */}
              <div className="lg:col-span-8 space-y-4">
                
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                  
                  {/* Table Header Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{t.adminTitle}</h3>
                      <p className="text-xs text-slate-500">{t.adminSubtitle}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {/* Refresh Database */}
                      <button
                        onClick={fetchInquiries}
                        disabled={isRefreshingAdmin}
                        className="p-2 text-slate-600 hover:text-slate-800 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-all"
                        title={t.adminTooltipRefresh}
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshingAdmin ? 'animate-spin' : ''}`} />
                      </button>

                      {/* Export Excel Button */}
                      <button
                        onClick={handleExportCSV}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {t.adminExportBtn}
                      </button>
                    </div>
                  </div>

                  {/* Active filters search bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mt-4">
                    
                    <div className="sm:col-span-8 relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <Search className="w-4 h-4" />
                      </span>
                      <input 
                        type="text" 
                        placeholder={t.adminSearchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      >
                        <option value="all">📁 {t.optAll}</option>
                        <option value="new">💎 {t.optNew}</option>
                        <option value="quoting">⚡ {t.optQuoting}</option>
                        <option value="closed">✅ {t.optClosed}</option>
                        <option value="unsuitable">❌ {t.optUnsuitable}</option>
                      </select>
                    </div>

                  </div>

                  {/* Operational inquiries list table wrapper */}
                  <div className="mt-6 space-y-4">
                    {adminError && <div className="p-3 bg-rose-50 text-xs text-rose-700 rounded-lg">{adminError}</div>}
                    {filteredInquiries.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs italic space-y-1">
                        <FolderOpenIcon className="w-8 h-8 mx-auto opacity-30" />
                        <p>{t.adminNoRecord}</p>
                      </div>
                    ) : (
                      filteredInquiries.map((inq) => (
                        <div 
                          key={inq.id}
                          className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-md transition-all space-y-4 relative"
                        >
                          
                          {/* Inner Row 1: Identification Code & Status */}
                          <div className="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-500">{t.adminRfqCode}: #{inq.id}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(inq.createdAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'zh-CN')}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Quick selection dropdown */}
                              <select
                                value={inq.status}
                                onChange={(e) => handleUpdateStatus(inq.id, e.target.value)}
                                className="px-2 py-1 border border-slate-200 rounded text-xs bg-white font-medium focus:outline-none"
                              >
                                <option value="new">💎 {t.optNew}</option>
                                <option value="quoting">⚡ {t.optQuoting}</option>
                                <option value="closed">✅ {t.optClosed}</option>
                                <option value="unsuitable">❌ {t.optUnsuitable}</option>
                              </select>
                              {getStatusBadge(inq.status)}
                            </div>
                          </div>

                          {/* Inner Row 2: Customer Profile (Split) */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            
                            {/* Profile details */}
                            <div className="md:col-span-7 space-y-2">
                              <div className="space-y-1">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t.adminCustInfoTitle}</h4>
                                <p className="text-sm font-semibold text-slate-900">{inq.customerName}</p>
                                <p className="text-xs text-slate-600 flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {inq.phone}
                                </p>
                                <p className="text-xs text-slate-600 flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {inq.address}
                                </p>
                                {inq.taxCode && (
                                  <p className="text-xs text-slate-500 font-mono">{t.formTaxCode}: {inq.taxCode}</p>
                                )}
                              </div>

                              <div className="bg-white/70 border border-slate-200/50 rounded-lg p-2.5 text-xs text-slate-700">
                                <p className="font-semibold text-slate-800">{t.adminRegQty} <span className="text-orange-600 font-bold">{inq.quantity} {t.qtyUnit}</span></p>
                                {inq.notes && (
                                  <p className="mt-1 italic text-slate-500">“{inq.notes}”</p>
                                )}
                              </div>
                            </div>

                            {/* AI analysis data & thumbnail */}
                            <div className="md:col-span-5 bg-white p-3 rounded-xl border border-slate-100 flex gap-3">
                              
                              {/* Tiny image display */}
                              <div className="h-20 w-20 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden shrink-0">
                                {inq.imageUrl.startsWith('data:') ? (
                                  <img 
                                    src={inq.imageUrl} 
                                    alt="Sản phẩm RFQ" 
                                    className="h-full w-full object-cover rounded-lg cursor-pointer hover:scale-110 transition-transform"
                                    onClick={() => {
                                      const w = window.open();
                                      w?.document.write(`<img src="${inq.imageUrl}" style="max-width:100%;" />`);
                                    }}
                                    title={t.clickBigImg}
                                  />
                                ) : (
                                  <img 
                                    src={inq.imageUrl} 
                                    alt="Sản phẩm RFQ" 
                                    className="h-full w-full object-cover rounded-lg"
                                  />
                                )}
                              </div>

                              {/* AI summary block */}
                              <div className="space-y-1 min-w-0">
                                <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold tracking-wide uppercase">{t.adminAiCheck}</span>
                                {inq.aiAnalysis ? (
                                  <div className="space-y-0.5">
                                    <h5 className="text-xs font-bold text-slate-900 truncate" title={inq.aiAnalysis.productName}>
                                      {inq.aiAnalysis.productName}
                                    </h5>
                                    <p className="text-[10px] text-slate-500 truncate">{inq.aiAnalysis.category}</p>
                                    <p className="text-[10px] text-slate-400 font-mono truncate">{t.adminMatchSuggest} {inq.aiAnalysis.equivalentCode || t.noEquivalent}</p>
                                    <div className="text-[10px] text-emerald-600 font-bold">{t.adminMatchConfidence} {inq.aiAnalysis.confidence}%</div>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-slate-400 italic">{t.adminNoMatchData}</p>
                                )}
                              </div>

                            </div>

                          </div>

                          {/* Inner Row 3: Admin Controls - Assigned Staff & Force Remove */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-semibold">{t.adminStaffAssigned}</span>
                              <input 
                                type="text"
                                placeholder={t.adminStaffPlaceholder}
                                defaultValue={inq.assignedStaff}
                                onBlur={(e) => handleUpdateStaff(inq.id, e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                              />
                            </div>

                            <button
                              onClick={() => handleDeleteInquiry(inq.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition-all"
                              title={t.adminRemoveTooltip}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                        </div>
                      ))
                    )}
                  </div>

                </div>

              </div>

              {/* Right Side: WeChat Custom Bot Connection */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* WeChat settings panel */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-emerald-500 animate-spin" />
                    {t.cfgWechatTitle}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {t.cfgWechatDesc}
                  </p>

                  <form onSubmit={handleSaveWeChatConfig} className="space-y-4">
                    
                    <div className="flex items-center justify-between pb-2 border-b border-slate-50 text-xs">
                      <span className="font-semibold text-slate-700">{t.cfgWechatSync}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={weChatEnabled} 
                          onChange={(e) => setWeChatEnabled(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">{t.cfgWechatWebhookUrl}</label>
                      <input 
                        type="url" 
                        placeholder="https://zalo.me/webhook/send/your-key-here..."
                        value={weChatUrl}
                        onChange={(e) => setWeChatUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-400 leading-normal">
                        {t.cfgWechatWebhookHelp}
                      </p>
                    </div>

                    {weChatFeedback && (
                      <div className={`p-2.5 rounded text-xs font-medium border ${
                        weChatFeedback.type === 'success' 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                          : 'bg-rose-50 border-rose-100 text-rose-800'
                      }`}>
                        {weChatFeedback.message}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleTestWeChat}
                        disabled={isTestingWeChat}
                        className="py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                      >
                        {isTestingWeChat ? t.btnSending : t.btnSendTest}
                      </button>

                      <button
                        type="submit"
                        className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all"
                      >
                        {t.btnSaveCfg}
                      </button>
                    </div>

                  </form>
                </div>

                {/* WeChat Delivery notification logs */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                  
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {t.logTitle} ({weChatLogs.length})
                    </h3>
                    <button 
                      onClick={fetchWeChatLogs} 
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 text-xs">
                    {weChatLogs.length === 0 ? (
                      <p className="text-slate-400 italic text-center py-6">{t.logEmpty}</p>
                    ) : (
                      weChatLogs.map((log) => (
                        <div 
                          key={log.id} 
                          className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 space-y-1.5"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[10px] text-slate-500 font-mono">ID: #{log.inquiryId}</span>
                            <span className="text-[9px] text-slate-400">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          {/* Status code log badge */}
                          <div className="flex items-center gap-1.5">
                            {log.status === 'success' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">{t.logSuccess}</span>
                            )}
                            {log.status === 'failed' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">{t.logFail}</span>
                            )}
                            {log.status === 'simulated' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-700">{t.logSimulated}</span>
                            )}
                          </div>

                          {/* Log Markdown message body preview */}
                          <div className="bg-slate-900 rounded p-2 text-[10px] text-zinc-300 font-mono overflow-x-auto whitespace-pre">
                            {log.payload?.markdown?.content || JSON.stringify(log.payload, null, 2)}
                          </div>

                          {log.error && (
                            <p className="text-[10px] text-red-600 font-bold font-mono">Lỗi: {log.error}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Corporate footer details */}
      <footer className="bg-white border-t border-slate-100 py-8 mt-auto text-xs text-slate-400 text-center space-y-2">
        <p>{t.footerCopyright}</p>
        <p className="text-[11px]">{t.footerPowered}</p>
      </footer>

      {/* Lightbox Modal for zooming in and checking image sharpness */}
      {isLightboxOpen && selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 select-none active:cursor-grabbing transition-all animate-fade-in"
        >
          {/* Header Controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-slate-900 text-emerald-400">
                <ZoomIn className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold">
                  {lang === 'vi' ? 'Kiểm tra độ sắc nét thiết bị' : '产品图片清晰度细节核验'}
                </h4>
                <p className="text-[10px] text-slate-400">
                  {lang === 'vi' 
                    ? `Thu phóng: ${Math.round(zoomScale * 100)}% | Xoay: ${rotateAngle}°` 
                    : `缩放: ${Math.round(zoomScale * 100)}% | 旋转: ${rotateAngle}°`}
                </p>
              </div>
            </div>

            {/* Quick Interactive Tooltip */}
            <p className="hidden md:block text-[11px] text-slate-400 font-medium bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
              {lang === 'vi' 
                ? '💡 Mẹo: Sử dụng nút bên dưới để căn chỉnh góc chụp trước khi gửi' 
                : '💡 提示：使用下方按钮，在提报前对齐旋转/缩放视角'}
            </p>

            <button
              onClick={() => setIsLightboxOpen(false)}
              className="p-2 bg-slate-800 hover:bg-rose-500 text-slate-350 hover:text-white rounded-full transition-all shadow-md flex items-center justify-center cursor-pointer"
              title={lang === 'vi' ? 'Đóng (Esc)' : '关闭 (Esc)'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Core Image Stage Area */}
          <div className="relative flex-1 w-full flex items-center justify-center overflow-auto my-16">
            <div 
              className="transition-all duration-300 ease-out max-w-full max-h-full flex items-center justify-center"
              style={{
                transform: `scale(${zoomScale}) rotate(${rotateAngle}deg)`,
              }}
            >
              <img 
                src={selectedImage} 
                alt="Bản sắc nét phóng to" 
                className="max-w-[85vw] max-h-[70vh] md:max-w-[70vw] md:max-h-[75vh] object-contain rounded-lg shadow-2xl select-none"
                draggable={false}
              />
            </div>
          </div>

          {/* Bottom Toolbar Controls */}
          <div className="absolute bottom-6 flex flex-wrap items-center justify-center gap-3 bg-slate-900/90 border border-slate-800 px-5 py-3 rounded-2xl shadow-xl z-10">
            {/* Zoom Out Button */}
            <button
              onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.25))}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
              title={lang === 'vi' ? 'Thu nhỏ' : '缩小'}
            >
              <ZoomOut className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'vi' ? 'Thu nhỏ' : '缩小'}</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={() => {
                setZoomScale(1);
                setRotateAngle(0);
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl transition-all text-xs font-semibold cursor-pointer"
              title={lang === 'vi' ? 'Mặc định' : '原图'}
            >
              {lang === 'vi' ? 'Khôi phục (100%)' : '重置比例 (100%)'}
            </button>

            {/* Zoom In Button */}
            <button
              onClick={() => setZoomScale(prev => Math.min(4, prev + 0.25))}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer"
              title={lang === 'vi' ? 'Phóng to' : '放大'}
            >
              <ZoomIn className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'vi' ? 'Phóng to' : '放大'}</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-800 hidden sm:block"></div>

            {/* Rotate Button */}
            <button
              onClick={() => setRotateAngle(prev => (prev + 90) % 360)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title={lang === 'vi' ? 'Xoay ảnh 90°' : '旋转 90°'}
            >
              <RotateCw className="w-4 h-4 text-orange-400" />
              <span>{lang === 'vi' ? 'Xoay 90°' : '旋转 90°'}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple fallback inline icons to prevent breaking TS builds
function FolderOpenIcon(props: { className?: string }) {
  return (
    <svg 
      className={props.className} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor" 
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9l-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

