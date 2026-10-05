'use client';

import React, { useState, useEffect } from 'react';

type Owner = '남편' | '아내' | '공통';
type InvestCategory = '해외직투' | '국내직투' | 'ISA' | '개인연금저축' | 'IRP' | '퇴직금';
type LoanCategory = '주택담보대출' | '사내대출' | '마이너스 통장' | '신용대출' | '기타대출';

interface StockAsset {
  id: string;
  owner: Owner;
  category: InvestCategory;
  name: string;
  ticker: string;
  currency: 'KRW' | 'USD';
  buyDate: string;
  quantity: number;
  buyPrice: number;     // 매입단가
  currentPrice: number; // 실시간 현재가
}

interface ManualAsset {
  home: number;        // 자가
  jeonse: number;      // 전세금
  deposit: number;     // 예금
}

interface LoanAsset {
  id: string;
  owner: Owner;
  category: LoanCategory;
  name: string;
  amount: number;       // 대출 원금
  interestRate: number; // 연이율 (%)
}

// 한글 화폐 단위(억/만) 변환
function formatKoreanWon(val: number): string {
  if (!val || isNaN(val) || val <= 0) return '0원';
  const eok = Math.floor(val / 100000000);
  const man = Math.floor((val % 100000000) / 10000);
  const rest = Math.floor(val % 10000);

  let res = '';
  if (eok > 0) res += `${eok}억 `;
  if (man > 0) res += `${man}만 `;
  if (rest > 0 && eok === 0 && man === 0) res += `${rest}`;
  return res.trim() + '원';
}

// 내부 API 서버(/api/quote)를 호출하여 실시간 시세 조회
async function fetchStockPrice(ticker: string): Promise<{ price: number; currency: 'KRW' | 'USD' } | null> {
  const clean = ticker.trim().toUpperCase();
  if (!clean || clean === 'CUSTOM') return null;

  try {
    const res = await fetch(`/api/quote?ticker=${encodeURIComponent(clean)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.price === 'number') {
        return { price: data.price, currency: data.currency };
      }
    }
  } catch (e) {
    console.error(`[${clean}] 시세 조회 에러:`, e);
  }
  return null;
}

export default function AssetDashboard() {
  const [exchangeRate, setExchangeRate] = useState<number>(1420);
  const [rateLoading, setRateLoading] = useState<boolean>(false);
  const [isUpdatingPrices, setIsUpdatingPrices] = useState<boolean>(false);
  const [lastPriceSyncTime, setLastPriceSyncTime] = useState<string>('');

  const [selectedOwner, setSelectedOwner] = useState<'전체' | Owner>('전체');
  const [expandedCategory, setExpandedCategory] = useState<InvestCategory | null>(null);

  // 1. 직접 금액 입력 자산 (남편, 아내, 공통)
  const [manualAssets, setManualAssets] = useState<Record<Owner, ManualAsset>>({
    남편: { home: 0, jeonse: 400000000, deposit: 50000000 },
    아내: { home: 0, jeonse: 0, deposit: 30000000 },
    공통: { home: 0, jeonse: 0, deposit: 20000000 },
  });

  // 2. 대출 목록
  const [loanAssets, setLoanAssets] = useState<LoanAsset[]>([
    { id: '1', owner: '남편', category: '주택담보대출', name: '아파트 담보대출', amount: 400000000, interestRate: 4.1 },
    { id: '2', owner: '남편', category: '사내대출', name: '회사 복지기금 대출', amount: 200000000, interestRate: 2.0 },
    { id: '3', owner: '남편', category: '마이너스 통장', name: '직장인 한도대출', amount: 50000000, interestRate: 4.8 },
  ]);

  // 3. 투자 자산 포트폴리오
  const [stockAssets, setStockAssets] = useState<StockAsset[]>([
    { id: '1', owner: '남편', category: '해외직투', name: '로켓랩', ticker: 'RKLB', currency: 'USD', buyDate: '2024-03-15', quantity: 810, buyPrice: 34.86, currentPrice: 135.76 },
    { id: '2', owner: '남편', category: '해외직투', name: '아이렌', ticker: 'IREN', currency: 'USD', buyDate: '2024-04-10', quantity: 1510, buyPrice: 13.87, currentPrice: 56.83 },
    { id: '3', owner: '남편', category: '해외직투', name: '테슬라', ticker: 'TSLA', currency: 'USD', buyDate: '2024-02-01', quantity: 55, buyPrice: 349.46, currentPrice: 426.01 },
    { id: '4', owner: '아내', category: '국내직투', name: '삼성전자', ticker: '005930', currency: 'KRW', buyDate: '2024-01-20', quantity: 47, buyPrice: 171000, currentPrice: 292500 },
    { id: '5', owner: '공통', category: 'ISA', name: 'TIGER 미국배당다우존스', ticker: '458730.KS', currency: 'KRW', buyDate: '2024-04-15', quantity: 1000, buyPrice: 10500, currentPrice: 11800 },
    { id: '6', owner: '남편', category: '개인연금저축', name: 'TIGER 미국S&P500', ticker: '360750.KS', currency: 'KRW', buyDate: '2024-05-02', quantity: 500, buyPrice: 16500, currentPrice: 18200 },
    { id: '7', owner: '남편', category: 'IRP', name: 'ACE 미국나스닥100', ticker: '367380.KS', currency: 'KRW', buyDate: '2024-06-11', quantity: 300, buyPrice: 15000, currentPrice: 16800 },
  ]);

  // 모달 제어
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  // 종목 기입 폼
  const [stockForm, setStockForm] = useState({
    owner: '남편' as Owner,
    category: '해외직투' as InvestCategory,
    name: '',
    ticker: '',
    currency: 'USD' as 'KRW' | 'USD',
    buyDate: new Date().toISOString().split('T')[0],
    quantity: '',
    buyPrice: '',
    currentPrice: '',
  });
  const [isFetchingSingle, setIsFetchingSingle] = useState(false);

  // 대출 기입 폼
  const [loanForm, setLoanForm] = useState({
    owner: '남편' as Owner,
    category: '주택담보대출' as LoanCategory,
    name: '',
    amount: '',
    interestRate: '',
  });

  // 실시간 환율 조회
  const fetchRealtimeRate = async () => {
    try {
      setRateLoading(true);
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      if (data?.rates?.KRW) {
        setExchangeRate(Math.round(data.rates.KRW * 10) / 10);
      }
    } catch (e) {
      console.error('환율 조회 실패', e);
    } finally {
      setRateLoading(false);
    }
  };

  // 등록된 전 종목 실시간 시세 일괄 업데이트
  const refreshAllStockPrices = async () => {
    if (isUpdatingPrices || stockAssets.length === 0) return;
    setIsUpdatingPrices(true);

    try {
      const updatedList = await Promise.all(
        stockAssets.map(async (asset) => {
          if (!asset.ticker || asset.ticker === 'CUSTOM') return asset;
          const quote = await fetchStockPrice(asset.ticker);
          if (quote && quote.price > 0) {
            return {
              ...asset,
              currentPrice: quote.price,
              currency: quote.currency,
            };
          }
          return asset;
        })
      );

      saveStocks(updatedList);
      setLastPriceSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('전체 시세 갱신 중 오류:', err);
    } finally {
      setIsUpdatingPrices(false);
    }
  };

  useEffect(() => {
    fetchRealtimeRate();
    const savedStocks = localStorage.getItem('v9_stocks');
    const savedManual = localStorage.getItem('v9_manual');
    const savedLoans = localStorage.getItem('v9_loans');
    if (savedStocks) setStockAssets(JSON.parse(savedStocks));
    if (savedManual) setManualAssets(JSON.parse(savedManual));
    if (savedLoans) setLoanAssets(JSON.parse(savedLoans));

    // 첫 실행 시 자동 시세 1회 동기화
    setTimeout(() => {
      refreshAllStockPrices();
    }, 1000);
  }, []);

  const saveStocks = (d: StockAsset[]) => { setStockAssets(d); localStorage.setItem('v9_stocks', JSON.stringify(d)); };
  const saveManual = (d: Record<Owner, ManualAsset>) => { setManualAssets(d); localStorage.setItem('v9_manual', JSON.stringify(d)); };
  const saveLoans = (d: LoanAsset[]) => { setLoanAssets(d); localStorage.setItem('v9_loans', JSON.stringify(d)); };

  // 단일 티커 실시간 시세 즉시 조회
  const handleQuerySingleTicker = async () => {
    if (!stockForm.ticker.trim()) {
      alert('티커를 먼저 입력해 주세요. (예: TSLA, AAPL, 005930)');
      return;
    }
    setIsFetchingSingle(true);
    const quote = await fetchStockPrice(stockForm.ticker);
    setIsFetchingSingle(false);

    if (quote && quote.price > 0) {
      setStockForm((prev) => ({
        ...prev,
        currentPrice: quote.price.toString(),
        currency: quote.currency,
      }));
    } else {
      alert(`[${stockForm.ticker}]의 실시간 시세를 찾을 수 없습니다. 티커 번호나 영문 심볼을 확인해 주세요.`);
    }
  };

  // 통화 변환 및 수익률 산출
  const getAssetKRW = (item: StockAsset) => {
    const rate = item.currency === 'USD' ? exchangeRate : 1;
    const valKRW = item.quantity * item.currentPrice * rate;
    const costKRW = item.quantity * item.buyPrice * rate;
    const profitKRW = valKRW - costKRW;
    const roi = costKRW > 0 ? (profitKRW / costKRW) * 100 : 0;
    return { valKRW, costKRW, profitKRW, roi };
  };

  const getCategoryStats = (cat: InvestCategory) => {
    const filtered = stockAssets
      .filter((a) => (selectedOwner === '전체' ? true : a.owner === selectedOwner))
      .filter((a) => a.category === cat);

    let totalVal = 0;
    let totalCost = 0;
    let totalUSDVal = 0;

    filtered.forEach((item) => {
      const { valKRW, costKRW } = getAssetKRW(item);
      totalVal += valKRW;
      totalCost += costKRW;
      if (item.currency === 'USD') totalUSDVal += item.quantity * item.currentPrice;
    });

    const profit = totalVal - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    return { totalVal, totalCost, profit, roi, totalUSDVal, count: filtered.length, items: filtered };
  };

  const getManualTotal = (key: keyof ManualAsset) => {
    if (selectedOwner === '전체') {
      return manualAssets.남편[key] + manualAssets.아내[key] + manualAssets.공통[key];
    }
    return manualAssets[selectedOwner][key];
  };

  // 1. 가용 자산
  const homeVal = getManualTotal('home');
  const jeonseVal = getManualTotal('jeonse');
  const depositVal = getManualTotal('deposit');
  const overseasStats = getCategoryStats('해외직투');
  const domesticStats = getCategoryStats('국내직투');
  const isaStats = getCategoryStats('ISA');
  const liquidAssets = homeVal + jeonseVal + depositVal + overseasStats.totalVal + domesticStats.totalVal + isaStats.totalVal;

  // 2. 노후 자금
  const pensionStats = getCategoryStats('개인연금저축');
  const irpStats = getCategoryStats('IRP');
  const severanceStats = getCategoryStats('퇴직금');
  const retirementAssets = pensionStats.totalVal + irpStats.totalVal + severanceStats.totalVal;

  // 3. 대출 및 월 이자
  const filteredLoans = loanAssets.filter((l) => (selectedOwner === '전체' ? true : l.owner === selectedOwner));
  const totalLoanAmount = filteredLoans.reduce((sum, l) => sum + l.amount, 0);
  const totalMonthlyInterest = filteredLoans.reduce((sum, l) => sum + (l.amount * (l.interestRate / 100)) / 12, 0);

  // 4. 총 순자산 = (가용 자산 + 노후 자금) - 총 대출
  const grandNetAssets = (liquidAssets + retirementAssets) - totalLoanAmount;

  // 종목 저장 (현재가 미조회 시 매입가 기본값)
  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockForm.name || !stockForm.quantity || !stockForm.buyPrice) return;

    const buyP = parseFloat(stockForm.buyPrice);
    const currP = stockForm.currentPrice ? parseFloat(stockForm.currentPrice) : buyP;

    const newItem: StockAsset = {
      id: Date.now().toString(),
      owner: stockForm.owner,
      category: stockForm.category,
      name: stockForm.name,
      ticker: stockForm.ticker.toUpperCase() || 'CUSTOM',
      currency: stockForm.currency,
      buyDate: stockForm.buyDate,
      quantity: parseFloat(stockForm.quantity),
      buyPrice: buyP,
      currentPrice: currP,
    };

    saveStocks([...stockAssets, newItem]);
    setIsStockModalOpen(false);
    setStockForm({
      owner: '남편',
      category: '해외직투',
      name: '',
      ticker: '',
      currency: 'USD',
      buyDate: new Date().toISOString().split('T')[0],
      quantity: '',
      buyPrice: '',
      currentPrice: '',
    });
  };

  // 대출 추가 핸들러
  const handleAddLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.name || !loanForm.amount || !loanForm.interestRate) return;

    const newLoan: LoanAsset = {
      id: Date.now().toString(),
      owner: loanForm.owner,
      category: loanForm.category,
      name: loanForm.name,
      amount: parseFloat(loanForm.amount),
      interestRate: parseFloat(loanForm.interestRate),
    };

    saveLoans([...loanAssets, newLoan]);
    setIsLoanModalOpen(false);
    setLoanForm({
      owner: '남편',
      category: '주택담보대출',
      name: '',
      amount: '',
      interestRate: '',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* 상단 헤더 & 소유자 필터 */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-800 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
              🏛️ 가계 통합 자산관리 대시보드
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              국내·해외 실시간 시세 연동 및 가용·노후·대출 3대 자산 축 정밀 관리
            </p>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            {(['전체', '남편', '아내', '공통'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedOwner(tab)}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition ${
                  selectedOwner === tab ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        {/* 시세/환율 액션 바 */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">기준 환율:</span>
              <span className="text-sm font-black text-emerald-400">₩{exchangeRate.toLocaleString()}</span>
              <button
                onClick={fetchRealtimeRate}
                disabled={rateLoading}
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 transition"
              >
                🔄 {rateLoading ? '...' : '환율 갱신'}
              </button>
            </div>

            <div className="border-l border-slate-800 pl-2.5 flex items-center gap-2">
              <button
                onClick={refreshAllStockPrices}
                disabled={isUpdatingPrices}
                className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-lg transition flex items-center gap-1.5 shadow-md shadow-indigo-950"
              >
                ⚡ {isUpdatingPrices ? '시세 수신 중...' : '전 종목 실시간 시세 갱신'}
              </button>
              {lastPriceSyncTime && (
                <span className="hidden sm:inline text-[11px] text-slate-500">
                  (동기화: {lastPriceSyncTime})
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700"
            >
              ⚙ 자가·전세·예금
            </button>
            <button
              onClick={() => setIsLoanModalOpen(true)}
              className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-rose-800/80"
            >
              💳 대출 관리
            </button>
            <button
              onClick={() => setIsStockModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-md shadow-blue-900/30"
            >
              + 투자 종목 기입
            </button>
          </div>
        </div>

        {/* 1. 최상위 순자산 카드 */}
        <div className="bg-gradient-to-br from-blue-950/70 via-slate-900 to-slate-900 border border-blue-900/50 p-6 rounded-3xl shadow-xl">
          <div className="flex flex-col md:flex-row justify-between md:items-end gap-5">
            <div>
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                [{selectedOwner}] 기준 총 순자산 (자산 - 대출)
              </span>
              <div className="text-3xl md:text-5xl font-black text-white mt-1">
                ₩ {Math.round(grandNetAssets).toLocaleString()}
                <span className="block text-xs font-normal text-slate-400 mt-1">
                  ({formatKoreanWon(grandNetAssets)})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6 text-left">
              <div>
                <p className="text-[11px] text-slate-400">가용 자산</p>
                <p className="text-sm md:text-base font-bold text-emerald-400 mt-0.5">
                  ₩ {Math.round(liquidAssets).toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-500">{formatKoreanWon(liquidAssets)}</span>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <p className="text-[11px] text-slate-400">노후 자금</p>
                <p className="text-sm md:text-base font-bold text-amber-400 mt-0.5">
                  ₩ {Math.round(retirementAssets).toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-500">{formatKoreanWon(retirementAssets)}</span>
              </div>
              <div className="border-l border-slate-800 pl-3">
                <p className="text-[11px] text-rose-400">총 대출(부채)</p>
                <p className="text-sm md:text-base font-bold text-rose-400 mt-0.5">
                  -₩ {Math.round(totalLoanAmount).toLocaleString()}
                </p>
                <span className="text-[10px] text-slate-500">{formatKoreanWon(totalLoanAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 자산 3대 영역 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* 가용 자산 */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h2 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                가용 가능한 금액
              </h2>
              <span className="font-bold text-emerald-400 text-xs">
                {formatKoreanWon(liquidAssets)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400">자가</span>
                <p className="font-bold mt-0.5 text-white">₩{Math.round(homeVal).toLocaleString()}</p>
                <p className="text-[9px] text-slate-500">{formatKoreanWon(homeVal)}</p>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400">전세금</span>
                <p className="font-bold mt-0.5 text-white">₩{Math.round(jeonseVal).toLocaleString()}</p>
                <p className="text-[9px] text-slate-500">{formatKoreanWon(jeonseVal)}</p>
              </div>
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400">예금</span>
                <p className="font-bold mt-0.5 text-white">₩{Math.round(depositVal).toLocaleString()}</p>
                <p className="text-[9px] text-slate-500">{formatKoreanWon(depositVal)}</p>
              </div>
              <div
                onClick={() => setExpandedCategory(expandedCategory === '해외직투' ? null : '해외직투')}
                className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer transition"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-blue-400 font-semibold">해외직투 ▾</span>
                  <span className={`text-[9px] font-bold ${overseasStats.roi >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    ({overseasStats.roi >= 0 ? '+' : ''}{overseasStats.roi.toFixed(1)}%)
                  </span>
                </div>
                <p className="font-bold mt-0.5 text-white">₩{Math.round(overseasStats.totalVal).toLocaleString()}</p>
                <p className="text-[9px] text-slate-500">${Math.round(overseasStats.totalUSDVal).toLocaleString()}</p>
              </div>
              <div
                onClick={() => setExpandedCategory(expandedCategory === '국내직투' ? null : '국내직투')}
                className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer transition"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-blue-400 font-semibold">국내직투 ▾</span>
                  <span className={`text-[9px] font-bold ${domesticStats.roi >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    ({domesticStats.roi >= 0 ? '+' : ''}{domesticStats.roi.toFixed(1)}%)
                  </span>
                </div>
                <p className="font-bold mt-0.5 text-white">₩{Math.round(domesticStats.totalVal).toLocaleString()}</p>
                <p className="text-[9px] text-slate-500">{domesticStats.count}개 종목</p>
              </div>
              <div
                onClick={() => setExpandedCategory(expandedCategory === 'ISA' ? null : 'ISA')}
                className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer transition"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-blue-400 font-semibold">ISA ▾</span>
                  <span className={`text-[9px] font-bold ${isaStats.roi >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    ({isaStats.roi >= 0 ? '+' : ''}{isaStats.roi.toFixed(1)}%)
                  </span>
                </div>
                <p className="font-bold mt-0.5 text-white">₩{Math.round(isaStats.totalVal).toLocaleString()}</p>
                <p className="text-[9px] text-slate-500">{isaStats.count}개 종목</p>
              </div>
            </div>
          </section>

          {/* 노후 자금 */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h2 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                노후 자금
              </h2>
              <span className="font-bold text-amber-400 text-xs">
                {formatKoreanWon(retirementAssets)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 text-xs">
              <div
                onClick={() => setExpandedCategory(expandedCategory === '개인연금저축' ? null : '개인연금저축')}
                className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 hover:border-amber-500 cursor-pointer transition flex justify-between items-center"
              >
                <div>
                  <span className="text-[10px] text-amber-400 font-semibold">개인연금저축 ▾</span>
                  <p className="font-bold text-white mt-0.5">₩{Math.round(pensionStats.totalVal).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold ${pensionStats.roi >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    ({pensionStats.roi >= 0 ? '+' : ''}{pensionStats.roi.toFixed(1)}%)
                  </span>
                  <p className="text-[9px] text-slate-500">{formatKoreanWon(pensionStats.totalVal)}</p>
                </div>
              </div>

              <div
                onClick={() => setExpandedCategory(expandedCategory === 'IRP' ? null : 'IRP')}
                className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 hover:border-amber-500 cursor-pointer transition flex justify-between items-center"
              >
                <div>
                  <span className="text-[10px] text-amber-400 font-semibold">IRP ▾</span>
                  <p className="font-bold text-white mt-0.5">₩{Math.round(irpStats.totalVal).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold ${irpStats.roi >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    ({irpStats.roi >= 0 ? '+' : ''}{irpStats.roi.toFixed(1)}%)
                  </span>
                  <p className="text-[9px] text-slate-500">{formatKoreanWon(irpStats.totalVal)}</p>
                </div>
              </div>

              <div
                onClick={() => setExpandedCategory(expandedCategory === '퇴직금' ? null : '퇴직금')}
                className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 hover:border-amber-500 cursor-pointer transition flex justify-between items-center"
              >
                <div>
                  <span className="text-[10px] text-amber-400 font-semibold">퇴직금 ▾</span>
                  <p className="font-bold text-white mt-0.5">₩{Math.round(severanceStats.totalVal).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold ${severanceStats.roi >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    ({severanceStats.roi >= 0 ? '+' : ''}{severanceStats.roi.toFixed(1)}%)
                  </span>
                  <p className="text-[9px] text-slate-500">{formatKoreanWon(severanceStats.totalVal)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 대출 (부채 현황) */}
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h2 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                대출 (부채 현황)
              </h2>
              <span className="font-bold text-rose-400 text-xs">
                -₩{Math.round(totalLoanAmount).toLocaleString()}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {filteredLoans.length === 0 ? (
                <p className="text-slate-500 text-center py-4">등록된 대출이 없습니다.</p>
              ) : (
                filteredLoans.map((loan) => (
                  <div key={loan.id} className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-900">
                          {loan.category}
                        </span>
                        <span className="font-semibold text-white">{loan.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        금리: <span className="text-amber-400 font-bold">{loan.interestRate}%</span>
                        <span className="ml-2 text-slate-500">(월 이자: 약 ₩{Math.round((loan.amount * (loan.interestRate / 100)) / 12).toLocaleString()})</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-400">₩{Math.round(loan.amount).toLocaleString()}</p>
                      <button
                        onClick={() => saveLoans(loanAssets.filter((l) => l.id !== loan.id))}
                        className="text-[10px] text-slate-500 hover:text-rose-400 ml-2"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-1 text-[11px] text-slate-400 flex justify-between border-t border-slate-800/80">
              <span>월 총 예상 이자:</span>
              <span className="font-bold text-rose-300">₩{Math.round(totalMonthlyInterest).toLocaleString()}</span>
            </div>
          </section>

        </div>

        {/* 3. 배너 클릭 시 열리는 세부 보유 종목 */}
        {expandedCategory && (
          <section className="bg-slate-900 border-2 border-blue-500/70 rounded-3xl p-5 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-200">
                📂 {expandedCategory} 세부 보유 종목 ({selectedOwner})
              </h3>
              <button onClick={() => setExpandedCategory(null)} className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg">
                닫기 ✕
              </button>
            </div>

            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">소유자</th>
                    <th className="py-2.5 px-3">종목(티커)</th>
                    <th className="py-2.5 px-3">매입일</th>
                    <th className="py-2.5 px-3">수량</th>
                    <th className="py-2.5 px-3">매입가</th>
                    <th className="py-2.5 px-3">현재가 (실시간)</th>
                    <th className="py-2.5 px-3">원화 평가액</th>
                    <th className="py-2.5 px-3">수익률</th>
                    <th className="py-2.5 px-3 text-center">삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {getCategoryStats(expandedCategory).items.map((item) => {
                    const { valKRW, roi } = getAssetKRW(item);
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-300">{item.owner}</td>
                        <td className="py-2.5 px-3 font-bold text-white">{item.name} ({item.ticker})</td>
                        <td className="py-2.5 px-3 text-slate-400">{item.buyDate}</td>
                        <td className="py-2.5 px-3">{item.quantity.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-slate-400">{item.currency === 'USD' ? `$${item.buyPrice}` : `₩${item.buyPrice.toLocaleString()}`}</td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">{item.currency === 'USD' ? `$${item.currentPrice}` : `₩${item.currentPrice.toLocaleString()}`}</td>
                        <td className="py-2.5 px-3 font-bold text-white">₩{Math.round(valKRW).toLocaleString()}</td>
                        <td className="py-2.5 px-3">
                          <span className={`font-semibold ${roi >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                            {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button onClick={() => saveStocks(stockAssets.filter((s) => s.id !== item.id))} className="text-slate-500 hover:text-red-400">
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 4. 전체 보유 종목 리스트 테이블 (삭제 버튼 및 원본 레이아웃 완전 유지) */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-sm md:text-base font-bold text-slate-200">
              전체 투자 종목 리스트 ({selectedOwner})
            </h2>
            <span className="text-xs text-slate-500">배너 터치 시 카테고리별 분리 조회</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-950/60 text-slate-400 text-[11px] border-b border-slate-800 uppercase">
                <tr>
                  <th className="py-2.5 px-3">소유자</th>
                  <th className="py-2.5 px-3">분류</th>
                  <th className="py-2.5 px-3">종목(티커)</th>
                  <th className="py-2.5 px-3">매입일자</th>
                  <th className="py-2.5 px-3">수량</th>
                  <th className="py-2.5 px-3">매입단가</th>
                  <th className="py-2.5 px-3">현재가 (실시간)</th>
                  <th className="py-2.5 px-3">원화 평가액</th>
                  <th className="py-2.5 px-3">수익률</th>
                  <th className="py-2.5 px-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stockAssets
                  .filter((a) => (selectedOwner === '전체' ? true : a.owner === selectedOwner))
                  .map((item) => {
                    const { valKRW, roi } = getAssetKRW(item);
                    const isProfit = roi >= 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.owner === '남편'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : item.owner === '아내'
                              ? 'bg-pink-950 text-pink-300 border border-pink-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}>
                            {item.owner}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-medium">{item.category}</td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          {item.name}
                          <span className="block text-[10px] font-normal text-slate-400">{item.ticker}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">{item.buyDate}</td>
                        <td className="py-2.5 px-3">{item.quantity.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {item.currency === 'USD' ? `$${item.buyPrice}` : `₩${item.buyPrice.toLocaleString()}`}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-400 font-bold">
                          {item.currency === 'USD' ? `$${item.currentPrice}` : `₩${item.currentPrice.toLocaleString()}`}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          ₩ {Math.round(valKRW).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`font-semibold ${isProfit ? 'text-red-400' : 'text-blue-400'}`}>
                            {isProfit ? '+' : ''}{roi.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => saveStocks(stockAssets.filter((s) => s.id !== item.id))}
                            className="text-slate-500 hover:text-red-400 text-xs transition"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 모달 1: 자가 / 전세금 / 예금 직접 입력 */}
        {isManualModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg p-6 rounded-3xl shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-white">자가 · 전세금 · 예금 설정</h3>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {(['남편', '아내', '공통'] as const).map((ownerKey) => (
                  <div key={ownerKey} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                    <p className="text-xs font-bold text-blue-400">{ownerKey} 자산</p>
                    {(['home', 'jeonse', 'deposit'] as const).map((fieldKey) => {
                      const label = fieldKey === 'home' ? '자가' : fieldKey === 'jeonse' ? '전세금' : '예금';
                      const currentVal = manualAssets[ownerKey][fieldKey];
                      return (
                        <div key={fieldKey}>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] text-slate-400">{label} (원)</label>
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                              {formatKoreanWon(currentVal)}
                            </span>
                          </div>
                          <input
                            type="number"
                            value={currentVal || ''}
                            placeholder="0"
                            onChange={(e) => saveManual({
                              ...manualAssets,
                              [ownerKey]: { ...manualAssets[ownerKey], [fieldKey]: Number(e.target.value) }
                            })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-4">
                <button onClick={() => setIsManualModalOpen(false)} className="px-4 py-2 bg-blue-600 rounded-xl text-xs font-bold text-white">
                  완료 및 닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 모달 2: 대출 추가 입력 */}
        {isLoanModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md p-6 rounded-3xl shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-white">💳 대출 내역 등록</h3>
              <form onSubmit={handleAddLoan} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400">차주(소유자)</label>
                    <select
                      value={loanForm.owner}
                      onChange={(e) => setLoanForm({ ...loanForm, owner: e.target.value as Owner })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    >
                      <option value="남편">남편</option>
                      <option value="아내">아내</option>
                      <option value="공통">공통</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">대출 분류</label>
                    <select
                      value={loanForm.category}
                      onChange={(e) => setLoanForm({ ...loanForm, category: e.target.value as LoanCategory })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    >
                      <option value="주택담보대출">주택담보대출</option>
                      <option value="사내대출">사내대출</option>
                      <option value="마이너스 통장">마이너스 통장</option>
                      <option value="신용대출">신용대출</option>
                      <option value="기타대출">기타대출</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400">대출 명칭</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 주담대, 사내대출, 마통"
                    value={loanForm.name}
                    onChange={(e) => setLoanForm({ ...loanForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] text-slate-400">대출 원금 (원)</label>
                    <span className="text-xs font-bold text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
                      {formatKoreanWon(Number(loanForm.amount))}
                    </span>
                  </div>
                  <input
                    type="number"
                    required
                    placeholder="예: 400000000"
                    value={loanForm.amount}
                    onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400">연이율 (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="예: 4.1"
                    value={loanForm.interestRate}
                    onChange={(e) => setLoanForm({ ...loanForm, interestRate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setIsLoanModalOpen(false)} className="px-4 py-2 bg-slate-800 rounded-xl text-xs text-slate-300">
                    취소
                  </button>
                  <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white">
                    대출 등록
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 모달 3: 주식 추가 (티커 기반 실시간 시세 즉시 조회) */}
        {isStockModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md p-6 rounded-3xl shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-white">투자 내역 기입 (국내/해외 티커 연동)</h3>
              <form onSubmit={handleAddStock} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400">소유자</label>
                    <select
                      value={stockForm.owner}
                      onChange={(e) => setStockForm({ ...stockForm, owner: e.target.value as Owner })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    >
                      <option value="남편">남편</option>
                      <option value="아내">아내</option>
                      <option value="공통">공통</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">계좌 분류</label>
                    <select
                      value={stockForm.category}
                      onChange={(e) => {
                        const cat = e.target.value as InvestCategory;
                        setStockForm({
                          ...stockForm,
                          category: cat,
                          currency: cat === '해외직투' ? 'USD' : 'KRW',
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    >
                      <option value="해외직투">해외직투</option>
                      <option value="국내직투">국내직투</option>
                      <option value="ISA">ISA</option>
                      <option value="개인연금저축">개인연금저축</option>
                      <option value="IRP">IRP</option>
                      <option value="퇴직금">퇴직금</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400">티커(심볼) - 국내/해외</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="예: TSLA, RKLB, 005930"
                      value={stockForm.ticker}
                      onChange={(e) => setStockForm({ ...stockForm, ticker: e.target.value })}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleQuerySingleTicker}
                      disabled={isFetchingSingle}
                      className="px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition whitespace-nowrap"
                    >
                      {isFetchingSingle ? '조회중...' : '시세 조회'}
                    </button>
                  </div>
                  {stockForm.currentPrice && (
                    <p className="text-[11px] text-emerald-400 mt-1">
                      ✓ 실시간 현재가 확인: {stockForm.currency === 'USD' ? `$${stockForm.currentPrice}` : `₩${Number(stockForm.currentPrice).toLocaleString()}`}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] text-slate-400">종목명</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 테슬라, 삼성전자"
                    value={stockForm.name}
                    onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400">매입 일자</label>
                    <input
                      type="date"
                      required
                      value={stockForm.buyDate}
                      onChange={(e) => setStockForm({ ...stockForm, buyDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">통화</label>
                    <select
                      value={stockForm.currency}
                      onChange={(e) => setStockForm({ ...stockForm, currency: e.target.value as 'KRW' | 'USD' })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    >
                      <option value="USD">USD ($ - 달러)</option>
                      <option value="KRW">KRW (₩ - 원화)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400">수량</label>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="수량"
                      value={stockForm.quantity}
                      onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <label className="text-[11px] text-slate-400">매입단가 ({stockForm.currency})</label>
                      {stockForm.currency === 'KRW' && (
                        <span className="text-[10px] font-bold text-emerald-400">
                          {formatKoreanWon(Number(stockForm.buyPrice))}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder={stockForm.currency === 'USD' ? '$ 단가' : '₩ 단가'}
                      value={stockForm.buyPrice}
                      onChange={(e) => setStockForm({ ...stockForm, buyPrice: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setIsStockModalOpen(false)} className="px-4 py-2 bg-slate-800 rounded-xl text-xs text-slate-300">
                    취소
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white">
                    저장하기
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}