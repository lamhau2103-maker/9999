/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Download, Upload, Check, X, AlertCircle } from 'lucide-react';

// Cấu trúc dữ liệu mỗi lần mua vàng
interface GoldPurchase {
  id: string;
  pricePerChi: number; // Giá lúc mua (VNĐ / 1 chỉ), số nguyên
  phanAmount: number;  // Số lượng quy đổi hoàn toàn ra PHÂN (số nguyên: 1 chỉ = 10 phân)
  createdAt: number;
}

// Cấu trúc file JSON sao lưu
interface BackupData {
  purchases: GoldPurchase[];
  currentPriceInput: string;
}

const STORAGE_KEY_PURCHASES = 'gold_tracker_9999_purchases_v1';
const STORAGE_KEY_CURRENT_PRICE = 'gold_tracker_9999_current_price_v1';
const STORAGE_KEY_INITIALIZED = 'gold_tracker_9999_init_v1';

// Dữ liệu mẫu tự kiểm tra theo đúng đề bài:
// Mua 1 chỉ giá 8.000.000 và 5 phân giá 8.400.000 -> tổng 1 chỉ 5 phân,
// tổng tiền 12.200.000 đ, giá trung bình 8.133.333 đ/chỉ, giá hiện tại 8.300.000 -> lời +250.000 đ
const SAMPLE_PURCHASES: GoldPurchase[] = [
  {
    id: 'sample-1',
    pricePerChi: 8000000,
    phanAmount: 10, // 1 chỉ 0 phân = 10 phân
    createdAt: 1730000000000,
  },
  {
    id: 'sample-2',
    pricePerChi: 8400000,
    phanAmount: 5, // 0 chỉ 5 phân = 5 phân
    createdAt: 1730000060000,
  },
];
const SAMPLE_CURRENT_PRICE = '8.300.000';

/**
 * Định dạng số nguyên thành chuỗi có dấu chấm ngăn cách hàng nghìn (ví dụ: 8.000.000)
 */
function formatNumberWithDots(value: number): string {
  const rounded = Math.round(Math.abs(value));
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Định dạng tiền tệ VNĐ (ví dụ: 8.000.000 đ)
 */
function formatVND(value: number): string {
  return `${formatNumberWithDots(value)} đ`;
}

/**
 * Chuyển chuỗi nhập có dấu chấm thành số nguyên
 */
function parseFormattedNumber(str: string): number {
  const digitsOnly = str.replace(/\D/g, '');
  if (!digitsOnly) return 0;
  return parseInt(digitsOnly, 10);
}

/**
 * Định dạng chuỗi đang gõ thành dạng có dấu chấm ngăn cách hàng nghìn
 */
function formatInputDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Quy đổi từ tổng số PHÂN (số nguyên) sang chuỗi hiển thị "X chỉ Y phân"
 * Công thức: 1 chỉ = 10 phân -> số chỉ = Math.floor(soPhan / 10), số phân lẻ = soPhan % 10
 */
function formatPhanToChiPhan(totalPhan: number): string {
  const chi = Math.floor(totalPhan / 10);
  const phan = totalPhan % 10;
  return `${chi} chỉ ${phan} phân`;
}

export default function App() {
  // Danh sách các lần mua (lưu trong localStorage)
  const [purchases, setPurchases] = useState<GoldPurchase[]>(() => {
    try {
      const isInitialized = localStorage.getItem(STORAGE_KEY_INITIALIZED);
      const saved = localStorage.getItem(STORAGE_KEY_PURCHASES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      if (!isInitialized) {
        localStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');
        localStorage.setItem(STORAGE_KEY_PURCHASES, JSON.stringify(SAMPLE_PURCHASES));
        localStorage.setItem(STORAGE_KEY_CURRENT_PRICE, SAMPLE_CURRENT_PRICE);
        return SAMPLE_PURCHASES;
      }
    } catch {
      // Bỏ qua lỗi đọc localStorage
    }
    return [];
  });

  // Giá hiện tại (đ/chỉ) - chỉ 1 ô nhập duy nhất, tự động lưu lại
  const [currentPriceInput, setCurrentPriceInput] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CURRENT_PRICE);
      if (saved !== null) return saved;
    } catch {
      // Bỏ qua lỗi đọc localStorage
    }
    return '';
  });

  // State cho form nhập mỗi lần mua
  const [buyPriceInput, setBuyPriceInput] = useState<string>('');
  const [chiInput, setChiInput] = useState<string>('0');
  const [phanInput, setPhanInput] = useState<string>('0');
  const [formError, setFormError] = useState<string>('');

  // State xác nhận xoá từng dòng (lưu id dòng đang chờ xác nhận)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // State sao lưu / khôi phục dữ liệu JSON
  const [showBackupPanel, setShowBackupPanel] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>('');
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Tự động lưu danh sách lần mua vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PURCHASES, JSON.stringify(purchases));
    } catch {
      // Bỏ qua lỗi ghi localStorage
    }
  }, [purchases]);

  // Tự động lưu giá hiện tại vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_PRICE, currentPriceInput);
    } catch {
      // Bỏ qua lỗi ghi localStorage
    }
  }, [currentPriceInput]);

  // ============================================================================
  // CÔNG THỨC TÍNH TOÁN (Quy đổi hoàn toàn về PHÂN - số nguyên để tránh sai số)
  // ============================================================================

  // 1. Tổng số phân vàng đang có = Σ (số phân mỗi lần mua)
  const totalPhan: number = purchases.reduce((sum, item) => sum + item.phanAmount, 0);

  // 2. Tổng tiền đã bỏ ra = Σ (giá mua × số phân ÷ 10)
  const totalCost: number = purchases.reduce((sum, item) => {
    const itemCost = Math.round((item.pricePerChi * item.phanAmount) / 10);
    return sum + itemCost;
  }, 0);

  // 3. Giá trung bình (đ/chỉ) = Tổng tiền đã bỏ ra ÷ (Tổng số phân ÷ 10), làm tròn đến đồng
  // Viết gọn tránh chia số thực nhiều lần: (totalCost * 10) / totalPhan
  const averagePriceExact: number = totalPhan > 0 ? (totalCost * 10) / totalPhan : 0;
  const averagePriceRounded: number = totalPhan > 0 ? Math.round(averagePriceExact) : 0;

  // 4. Lời / Lỗ = (Giá hiện tại − Giá trung bình) × (Tổng số phân ÷ 10)
  // Phần trăm (%) = (Giá hiện tại − Giá trung bình) ÷ Giá trung bình × 100
  const currentPrice: number = parseFormattedNumber(currentPriceInput);
  const hasCurrentPrice: boolean = currentPrice > 0 && totalPhan > 0;

  const profitLossAmount: number = hasCurrentPrice
    ? Math.round(((currentPrice - averagePriceExact) * totalPhan) / 10)
    : 0;

  const profitLossPercent: number =
    hasCurrentPrice && averagePriceExact > 0
      ? ((currentPrice - averagePriceExact) / averagePriceExact) * 100
      : 0;

  // 5. Tổng số tiền đã được tính lời lỗ còn lại = Tổng tiền đã bỏ ra + Lời / Lỗ
  const totalAfterProfitLoss: number = hasCurrentPrice ? totalCost + profitLossAmount : 0;

  // ============================================================================
  // XỬ LÝ THÊM LẦN MUA
  // ============================================================================
  const handleAddPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const price = parseFormattedNumber(buyPriceInput);
    const chi = chiInput.trim() === '' ? 0 : parseInt(chiInput, 10);
    const phan = phanInput.trim() === '' ? 0 : parseInt(phanInput, 10);

    // Kiểm tra hợp lệ: giá > 0
    if (!price || price <= 0) {
      setFormError('Vui lòng nhập giá lúc mua lớn hơn 0.');
      return;
    }

    // Kiểm tra chỉ và phân là số nguyên hợp lệ (phân từ 0 đến 9)
    if (isNaN(chi) || chi < 0 || !Number.isInteger(chi)) {
      setFormError('Số chỉ phải là số nguyên từ 0 trở lên.');
      return;
    }

    if (isNaN(phan) || phan < 0 || phan > 9 || !Number.isInteger(phan)) {
      setFormError('Số phân phải từ 0 đến 9.');
      return;
    }

    // Quy đổi về PHÂN (số nguyên): 1 chỉ = 10 phân
    const totalItemPhan = chi * 10 + phan;

    // Kiểm tra tổng số lượng > 0
    if (totalItemPhan <= 0) {
      setFormError('Tổng số lượng vàng phải lớn hơn 0.');
      return;
    }

    const newPurchase: GoldPurchase = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pricePerChi: price,
      phanAmount: totalItemPhan,
      createdAt: Date.now(),
    };

    setPurchases((prev) => [newPurchase, ...prev]);
    setBuyPriceInput('');
    setChiInput('0');
    setPhanInput('0');
  };

  // Xử lý xoá 1 lần mua sau khi đã xác nhận
  const handleConfirmDelete = (id: string) => {
    setPurchases((prev) => prev.filter((item) => item.id !== id));
    setConfirmDeleteId(null);
  };

  // ============================================================================
  // XỬ LÝ XUẤT / NHẬP DỮ LIỆU JSON
  // ============================================================================
  const handleOpenBackup = () => {
    const payload: BackupData = {
      purchases,
      currentPriceInput,
    };
    setJsonText(JSON.stringify(payload, null, 2));
    setBackupMessage(null);
    setShowBackupPanel((prev) => !prev);
  };

  const handleExportJsonFile = () => {
    const payload: BackupData = {
      purchases,
      currentPriceInput,
    };
    const jsonString = JSON.stringify(payload, null, 2);
    setJsonText(jsonString);

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `so-vang-9999-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setBackupMessage({ type: 'success', text: 'Đã xuất file JSON thành công.' });
  };

  const applyImportedJson = (rawText: string) => {
    try {
      const parsed = JSON.parse(rawText);
      const rawList = Array.isArray(parsed) ? parsed : parsed?.purchases;

      if (!Array.isArray(rawList)) {
        setBackupMessage({ type: 'error', text: 'Dữ liệu JSON không đúng định dạng.' });
        return;
      }

      const validPurchases: GoldPurchase[] = [];
      for (const item of rawList) {
        const price = Number(item.pricePerChi);
        const phan = Number(item.phanAmount);
        if (!Number.isInteger(price) || price <= 0 || !Number.isInteger(phan) || phan <= 0) {
          setBackupMessage({
            type: 'error',
            text: 'Dữ liệu chứa giá hoặc số phân không hợp lệ.',
          });
          return;
        }
        validPurchases.push({
          id: String(item.id || `${Date.now()}-${Math.random()}`),
          pricePerChi: price,
          phanAmount: phan,
          createdAt: Number(item.createdAt || Date.now()),
        });
      }

      setPurchases(validPurchases);
      if (typeof parsed?.currentPriceInput === 'string') {
        setCurrentPriceInput(formatInputDigits(parsed.currentPriceInput));
      }
      setJsonText(JSON.stringify({ purchases: validPurchases, currentPriceInput: parsed?.currentPriceInput || currentPriceInput }, null, 2));
      setBackupMessage({ type: 'success', text: 'Đã nhập dữ liệu thành công.' });
    } catch {
      setBackupMessage({ type: 'error', text: 'Lỗi đọc JSON. Vui lòng kiểm tra lại nội dung.' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setJsonText(content);
      applyImportedJson(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadSampleExample = () => {
    setPurchases(SAMPLE_PURCHASES);
    setCurrentPriceInput(SAMPLE_CURRENT_PRICE);
    setFormError('');
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0b0716] text-white pb-14">
      {/* Nền hiệu ứng ánh sáng mờ ảo đa sắc (Aurora Glassmorphism) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Quầng sáng Vàng Hoàng Kim */}
        <div className="orb-float-1 absolute -top-24 -left-20 w-80 h-80 sm:w-[28rem] sm:h-[28rem] rounded-full bg-gradient-to-br from-amber-400/35 via-yellow-500/25 to-orange-500/20 blur-[90px]" />
        {/* Quầng sáng Tím Huyền Ảo */}
        <div className="orb-float-2 absolute top-1/4 -right-24 w-96 h-96 sm:w-[32rem] sm:h-[32rem] rounded-full bg-gradient-to-bl from-fuchsia-500/30 via-purple-600/25 to-indigo-600/25 blur-[110px]" />
        {/* Quầng sáng Ngọc Lục Bảo & Xanh Lam dưới đáy */}
        <div className="orb-float-3 absolute -bottom-28 left-1/4 w-80 h-80 sm:w-[30rem] sm:h-[30rem] rounded-full bg-gradient-to-tr from-cyan-400/25 via-emerald-400/20 to-amber-300/25 blur-[100px]" />
        {/* Lớp lưới ánh sáng mỏng tạo chiều sâu */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.12),transparent_60%)]" />
      </div>

      {/* Thanh tiêu đề kính mờ trong suốt */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/[0.07] border-b border-white/15 shadow-lg shadow-black/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-200 bg-clip-text text-transparent whitespace-nowrap shrink-0">
            Sổ Vàng 9999
          </h1>
          <button
            type="button"
            onClick={handleOpenBackup}
            className="min-h-[44px] px-3.5 py-2 text-sm font-semibold text-amber-100 bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/20 rounded-xl backdrop-blur-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 shadow-sm"
          >
            <Download className="w-4 h-4 text-amber-300" />
            <span>Xuất / Nhập dữ liệu</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Khu vực Xuất / Nhập dữ liệu JSON (khi mở) */}
        {showBackupPanel && (
          <section className="backdrop-blur-2xl bg-white/[0.10] rounded-3xl border border-white/20 p-5 sm:p-6 space-y-4 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-amber-200">
                Sao lưu & Khôi phục dữ liệu (JSON)
              </h2>
              <button
                type="button"
                onClick={() => setShowBackupPanel(false)}
                aria-label="Đóng bảng sao lưu"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:text-white bg-white/5 hover:bg-white/15 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportJsonFile}
                className="min-h-[48px] px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-bold text-base rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-amber-500/25 whitespace-nowrap shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Tải file JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[48px] px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white font-semibold text-base rounded-xl flex items-center gap-2 transition-all whitespace-nowrap shrink-0"
              >
                <Upload className="w-4 h-4 text-cyan-300" />
                <span>Chọn file JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="backup-json-textarea" className="block text-sm font-medium text-purple-100/85">
                Hoặc sao chép / dán trực tiếp nội dung JSON bên dưới:
              </label>
              <textarea
                id="backup-json-textarea"
                rows={4}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full p-3.5 text-sm font-mono-num bg-black/40 text-amber-100 border border-white/20 rounded-2xl focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => applyImportedJson(jsonText)}
                  className="min-h-[44px] px-4 py-2 bg-gradient-to-r from-fuchsia-500 to-indigo-500 hover:from-fuchsia-400 hover:to-indigo-400 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-fuchsia-500/20 whitespace-nowrap shrink-0"
                >
                  Nhập từ ô văn bản
                </button>
              </div>
            </div>

            {backupMessage && (
              <p
                className={`text-base font-semibold ${
                  backupMessage.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {backupMessage.text}
              </p>
            )}
          </section>
        )}

        {/* Bố cục ưu tiên điện thoại (1 cột), mở rộng 2 cột cân đối trên màn hình lớn */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI: KẾT QUẢ TỨC THÌ & FORM NHẬP LIỆU */}
          <div className="lg:col-span-5 space-y-6">
            {/* PHẦN 1: KẾT QUẢ (cập nhật tức thì) */}
            <section
              aria-label="Kết quả tổng hợp"
              className="backdrop-blur-2xl bg-white/[0.09] rounded-3xl border border-white/20 p-5 sm:p-6 space-y-5 shadow-2xl shadow-black/40"
            >
              <h2 className="text-lg font-bold text-amber-200 border-b border-white/15 pb-3">
                Kết quả hiện tại
              </h2>

              {/* Tổng vàng & Tổng tiền (thu nhỏ gọn hơn) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.04] border border-white/15 rounded-xl px-3.5 py-2.5">
                  <div className="text-xs font-medium text-purple-200/80">Tổng vàng đang có</div>
                  <div className="mt-0.5 text-lg sm:text-xl font-bold text-white font-mono-num">
                    {formatPhanToChiPhan(totalPhan)}
                  </div>
                </div>

                <div className="backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.04] border border-white/15 rounded-xl px-3.5 py-2.5">
                  <div className="text-xs font-medium text-purple-200/80">Tổng tiền đã bỏ ra</div>
                  <div className="mt-0.5 text-lg sm:text-xl font-bold text-cyan-200 font-mono-num">
                    {formatVND(totalCost)}
                  </div>
                </div>
              </div>

              {/* Ô Tổng số tiền đã được tính lời lỗ còn lại */}
              <div className="backdrop-blur-md bg-gradient-to-br from-white/[0.12] to-white/[0.04] border border-white/15 rounded-2xl p-4">
                <div className="text-sm font-medium text-purple-200/80">
                  Tổng số tiền sau lời / lỗ còn lại
                </div>
                {!hasCurrentPrice ? (
                  <div className="mt-1 text-2xl sm:text-3xl font-bold text-white/40 font-mono-num">
                    —
                  </div>
                ) : (
                  <div className="mt-1 text-2xl sm:text-3xl font-bold text-amber-200 font-mono-num">
                    {formatVND(totalAfterProfitLoss)}
                  </div>
                )}
              </div>

              {/* Giá vốn trung bình (thu nhỏ gọn) */}
              <div className="backdrop-blur-md bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-orange-500/25 border border-amber-300/40 rounded-xl px-3.5 py-2.5 shadow-inner flex items-center justify-between gap-2">
                <div className="text-xs sm:text-sm font-semibold text-amber-200">
                  Giá trung bình (vốn)
                </div>
                <div className="text-base sm:text-lg font-bold text-amber-300 font-mono-num">
                  {totalPhan > 0 ? `${formatNumberWithDots(averagePriceRounded)} đ/chỉ` : '0 đ/chỉ'}
                </div>
              </div>

              {/* Ô nhập Giá hiện tại (đ/chỉ) - tự động lưu và tính tức thì */}
              <div className="space-y-2 pt-1">
                <label
                  htmlFor="current-price-input"
                  className="block text-base font-bold text-amber-100"
                >
                  Giá hiện tại (đ/chỉ)
                </label>
                <div className="relative">
                  <input
                    id="current-price-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ví dụ: 8.300.000"
                    value={currentPriceInput}
                    onChange={(e) => setCurrentPriceInput(formatInputDigits(e.target.value))}
                    className="w-full min-h-[54px] px-4 pr-16 text-xl font-bold font-mono-num bg-black/35 border-2 border-amber-300/40 rounded-2xl text-white placeholder:text-white/35 focus:outline-none focus:border-amber-300 focus:bg-black/50 transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-semibold text-amber-200/75 pointer-events-none">
                    đ/chỉ
                  </span>
                </div>
              </div>

              {/* Ô Lời / Lỗ */}
              <div
                className={`rounded-2xl p-4 border backdrop-blur-md transition-colors ${
                  !hasCurrentPrice
                    ? 'bg-white/[0.06] border-white/15'
                    : profitLossAmount > 0
                    ? 'bg-emerald-500/20 border-emerald-400/45 shadow-lg shadow-emerald-950/40'
                    : profitLossAmount < 0
                    ? 'bg-rose-500/20 border-rose-400/45 shadow-lg shadow-rose-950/40'
                    : 'bg-white/[0.08] border-white/20'
                }`}
              >
                <div className="text-sm font-semibold text-white/80">Lời / Lỗ tạm tính</div>
                {!hasCurrentPrice ? (
                  <div className="mt-1 text-2xl sm:text-3xl font-bold text-white/40 font-mono-num">
                    —
                  </div>
                ) : profitLossAmount > 0 ? (
                  <div className="mt-1 text-2xl sm:text-3xl font-bold text-emerald-300 font-mono-num break-words">
                    +{formatVND(profitLossAmount)}{' '}
                    <span className="text-lg sm:text-xl font-semibold text-emerald-200">
                      (+{profitLossPercent.toFixed(2).replace('.', ',')}%)
                    </span>
                  </div>
                ) : profitLossAmount < 0 ? (
                  <div className="mt-1 text-2xl sm:text-3xl font-bold text-rose-300 font-mono-num break-words">
                    −{formatVND(Math.abs(profitLossAmount))}{' '}
                    <span className="text-lg sm:text-xl font-semibold text-rose-200">
                      (−{Math.abs(profitLossPercent).toFixed(2).replace('.', ',')}%)
                    </span>
                  </div>
                ) : (
                  <div className="mt-1 text-2xl sm:text-3xl font-bold text-white font-mono-num">
                    0 đ (0,00%)
                  </div>
                )}
              </div>
            </section>

            {/* PHẦN 2: NHẬP LIỆU MỖI LẦN MUA */}
            <section
              aria-label="Thêm lần mua mới"
              className="backdrop-blur-2xl bg-white/[0.09] rounded-3xl border border-white/20 p-5 sm:p-6 shadow-2xl shadow-black/40"
            >
              <h2 className="text-lg font-bold text-amber-200 border-b border-white/15 pb-3 mb-4">
                Nhập lần mua vàng
              </h2>

              <form onSubmit={handleAddPurchase} className="space-y-4" noValidate>
                {/* 1. Giá lúc mua (đ/chỉ) */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="buy-price-input"
                    className="block text-base font-semibold text-white/95"
                  >
                    1. Giá lúc mua (đ/chỉ)
                  </label>
                  <div className="relative">
                    <input
                      id="buy-price-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="Ví dụ: 8.000.000"
                      value={buyPriceInput}
                      onChange={(e) => {
                        setBuyPriceInput(formatInputDigits(e.target.value));
                        if (formError) setFormError('');
                      }}
                      className="w-full min-h-[54px] px-4 pr-16 text-xl font-bold font-mono-num bg-black/35 border border-white/25 rounded-2xl text-white placeholder:text-white/35 focus:bg-black/55 focus:outline-none focus:border-amber-300 transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-semibold text-amber-200/75 pointer-events-none">
                      đ/chỉ
                    </span>
                  </div>
                </div>

                {/* 2. Số lượng: 2 ô "chỉ" và "phân" */}
                <div className="space-y-1.5">
                  <span className="block text-base font-semibold text-white/95">
                    2. Số lượng mua (1 chỉ = 10 phân)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="chi-input"
                        className="block text-sm font-medium text-purple-200/85 mb-1"
                      >
                        Số chỉ
                      </label>
                      <div className="relative">
                        <input
                          id="chi-input"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={chiInput}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setChiInput(val);
                            if (formError) setFormError('');
                          }}
                          className="w-full min-h-[54px] px-4 pr-12 text-xl font-bold font-mono-num bg-black/35 border border-white/25 rounded-2xl text-white focus:bg-black/55 focus:outline-none focus:border-amber-300"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-semibold text-amber-200/75 pointer-events-none">
                          chỉ
                        </span>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="phan-input"
                        className="block text-sm font-medium text-purple-200/85 mb-1"
                      >
                        Số phân (0 – 9)
                      </label>
                      <div className="relative">
                        <select
                          id="phan-input"
                          value={phanInput}
                          onChange={(e) => {
                            setPhanInput(e.target.value);
                            if (formError) setFormError('');
                          }}
                          className="w-full min-h-[54px] px-4 text-xl font-bold font-mono-num bg-black/35 border border-white/25 rounded-2xl text-white focus:bg-black/55 focus:outline-none focus:border-amber-300"
                        >
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <option key={num} value={String(num)} className="bg-slate-900 text-white">
                              {num} phân
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Thông báo lỗi ngắn gọn nếu nhập sai */}
                {formError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 p-3.5 rounded-2xl bg-rose-500/25 border border-rose-400/50 text-rose-200 text-base font-semibold backdrop-blur-md"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-300" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* 3. Nút "Thêm lần mua" */}
                <button
                  type="submit"
                  className="w-full min-h-[54px] px-5 py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-[0.99] text-slate-950 text-lg font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/30 whitespace-nowrap"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                  <span>Thêm lần mua</span>
                </button>
              </form>
            </section>
          </div>

          {/* CỘT PHẢI: DANH SÁCH CÁC LẦN MUA */}
          <div className="lg:col-span-7">
            <section
              aria-label="Danh sách các lần mua"
              className="backdrop-blur-2xl bg-white/[0.09] rounded-3xl border border-white/20 p-5 sm:p-6 shadow-2xl shadow-black/40"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-3 mb-4">
                <h2 className="text-lg font-bold text-amber-200">
                  Danh sách các lần mua ({purchases.length})
                </h2>
                {purchases.length === 0 && (
                  <button
                    type="button"
                    onClick={handleLoadSampleExample}
                    className="min-h-[44px] px-3.5 py-1.5 text-sm font-semibold text-amber-200 bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/30 rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    Nạp ví dụ mẫu
                  </button>
                )}
              </div>

              {purchases.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-lg text-white/75">
                    Chưa có lần mua nào được ghi nhận.
                  </p>
                  <p className="text-sm text-purple-200/60">
                    Nhập giá và số lượng ở biểu mẫu để bắt đầu theo dõi.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/15 bg-black/25 backdrop-blur-md overflow-hidden">
                  <ul className="divide-y divide-white/10">
                    {purchases.map((item, index) => {
                      // Thành tiền mỗi lần mua = giá mua × số phân ÷ 10
                      const itemCost = Math.round((item.pricePerChi * item.phanAmount) / 10);
                      const isConfirming = confirmDeleteId === item.id;

                      return (
                        <li
                          key={item.id}
                          className="px-3.5 py-2.5 transition-colors hover:bg-white/[0.06]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs sm:text-sm font-mono-num">
                              <span className="font-bold text-fuchsia-300 shrink-0">
                                #{purchases.length - index}
                              </span>
                              <span className="font-bold text-white shrink-0">
                                {formatPhanToChiPhan(item.phanAmount)}
                              </span>
                              <span className="text-white/35" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-purple-100/85 shrink-0">
                                Giá: {formatNumberWithDots(item.pricePerChi)} đ/chỉ
                              </span>
                              <span className="text-white/35" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-bold text-amber-300 shrink-0">
                                Thành tiền: {formatVND(itemCost)}
                              </span>
                            </div>

                            {/* Nút xoá từng dòng (có xác nhận) */}
                            <div className="flex items-center shrink-0">
                              {isConfirming ? (
                                <div className="flex items-center gap-1.5 bg-rose-500/25 border border-rose-400/50 px-2 py-1 rounded-lg backdrop-blur-md">
                                  <span className="text-xs font-semibold text-rose-100 whitespace-nowrap">
                                    Xoá dòng này?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDelete(item.id)}
                                    className="px-2 py-1 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Xoá</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white border border-white/25 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0"
                                  >
                                    Huỷ
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  aria-label={`Xoá lần mua ${formatPhanToChiPhan(item.phanAmount)}`}
                                  className="px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:text-rose-200 bg-white/10 hover:bg-rose-500/30 border border-white/15 hover:border-rose-400/40 rounded-lg flex items-center gap-1 transition-all whitespace-nowrap shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xoá</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
