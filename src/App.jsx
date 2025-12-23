import React, { useState, useRef, useEffect } from 'react';
import { Upload, Ruler, Undo, ZoomIn, ZoomOut, Info, Trash2, CheckCircle, MousePointer2, Camera, Image as ImageIcon } from 'lucide-react';

const App = () => {
  // --- STATE QUẢN LÝ DỮ LIỆU ---
  const [image, setImage] = useState(null);
  const [mode, setMode] = useState('upload'); // 'upload', 'calibrate', 'measure', 'result'
   
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [calibPoints, setCalibPoints] = useState([]); 
  const [measurePoints, setMeasurePoints] = useState([]); 
  const [realDistance, setRealDistance] = useState('');
  const [pixelsPerMeter, setPixelsPerMeter] = useState(null);
  const [calculatedArea, setCalculatedArea] = useState(null);

  const [showInputModal, setShowInputModal] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // --- LOGIC XỬ LÝ ẢNH ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setMode('calibrate');
          setScale(1);
          setOffset({ x: 0, y: 0 });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // --- VẼ CANVAS (Giữ nguyên logic cũ) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    canvas.width = containerRef.current.clientWidth;
    canvas.height = containerRef.current.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    ctx.drawImage(image, 0, 0);

    const drawPoint = (x, y, color) => {
      ctx.beginPath();
      ctx.arc(x, y, 6 / scale, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
    };

    if (calibPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(calibPoints[0].x, calibPoints[0].y);
      if (calibPoints.length > 1) {
        ctx.lineTo(calibPoints[1].x, calibPoints[1].y);
      } else {
        const mouseImgPos = screenToImage(cursorPos.x, cursorPos.y);
        ctx.lineTo(mouseImgPos.x, mouseImgPos.y);
      }
      ctx.strokeStyle = '#ef4444'; 
      ctx.lineWidth = 3 / scale;
      ctx.stroke();
      calibPoints.forEach(p => drawPoint(p.x, p.y, '#ef4444'));
    }

    if (measurePoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(measurePoints[0].x, measurePoints[0].y);
      measurePoints.forEach((p, index) => {
        if (index > 0) ctx.lineTo(p.x, p.y);
      });
      
      if (mode === 'measure') {
        const mouseImgPos = screenToImage(cursorPos.x, cursorPos.y);
        ctx.lineTo(mouseImgPos.x, mouseImgPos.y);
      }

      ctx.strokeStyle = '#3b82f6'; 
      ctx.lineWidth = 3 / scale;
      ctx.stroke();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fill();
      measurePoints.forEach(p => drawPoint(p.x, p.y, '#3b82f6'));
    }
    ctx.restore();
  }, [image, scale, offset, calibPoints, measurePoints, cursorPos, mode]);

  // --- HỆ TỌA ĐỘ ---
  const screenToImage = (screenX, screenY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - offset.x) / scale,
      y: (screenY - rect.top - offset.y) / scale
    };
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const factor = 1 + (e.deltaY > 0 ? -1 : 1) * zoomIntensity;
    const newScale = Math.min(Math.max(0.1, scale * factor), 20);
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newOffset = {
      x: mouseX - (mouseX - offset.x) * (newScale / scale),
      y: mouseY - (mouseY - offset.y) * (newScale / scale)
    };
    setScale(newScale);
    setOffset(newOffset);
  };

  const handleMouseDown = (e) => {
    if (e.button === 1 || e.shiftKey) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }
    const { x, y } = screenToImage(e.clientX, e.clientY);
    if (mode === 'calibrate') {
      if (calibPoints.length < 2) {
        const newPoints = [...calibPoints, { x, y }];
        setCalibPoints(newPoints);
        if (newPoints.length === 2) setTimeout(() => setShowInputModal(true), 50);
      }
    } else if (mode === 'measure') {
      setMeasurePoints([...measurePoints, { x, y }]);
    }
  };

  const handleMouseMove = (e) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
    if (isDragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  // --- TÍNH TOÁN ---
  const confirmCalibration = () => {
    if (!realDistance || isNaN(realDistance) || parseFloat(realDistance) <= 0) {
      alert("Vui lòng nhập số hợp lệ!");
      return;
    }
    const distPx = Math.sqrt(Math.pow(calibPoints[1].x - calibPoints[0].x, 2) + Math.pow(calibPoints[1].y - calibPoints[0].y, 2));
    setPixelsPerMeter(distPx / parseFloat(realDistance));
    setShowInputModal(false);
    setMode('measure');
  };

  const calculateArea = () => {
    if (measurePoints.length < 3) return alert("Cần ít nhất 3 điểm!");
    let area = 0;
    const n = measurePoints.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += measurePoints[i].x * measurePoints[j].y;
      area -= measurePoints[j].x * measurePoints[i].y;
    }
    area = Math.abs(area) / 2;
    setCalculatedArea(area / Math.pow(pixelsPerMeter, 2));
    setMode('result');
  };

  const resetAll = () => {
    setImage(null); setMode('upload');
    setCalibPoints([]); setMeasurePoints([]);
    setPixelsPerMeter(null); setCalculatedArea(null); setRealDistance('');
  };

  return (
    <div className="flex flex-col h-screen text-gray-800 font-sans bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center z-10 shrink-0 h-16 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Ruler size={20} /></div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight hidden sm:block">Đo Diện Tích</h1>
            <h1 className="text-lg font-bold text-gray-900 leading-tight sm:hidden">Đo DT</h1>
          </div>
        </div>
        
        {image && (
          <div className="flex gap-2 items-center">
            <div className="hidden sm:flex bg-gray-100 rounded-lg p-1">
              <button onClick={() => {setMode('calibrate'); setCalibPoints([]);}} className={`px-3 py-1.5 rounded text-sm font-bold ${mode==='calibrate'?'bg-white shadow text-red-600':'text-gray-500'}`}>1. Tỷ Lệ</button>
              <button onClick={() => {if(!pixelsPerMeter) return alert('Cần chỉnh tỷ lệ trước'); setMode('measure'); setMeasurePoints([]); setCalculatedArea(null);}} className={`px-3 py-1.5 rounded text-sm font-bold ${mode==='measure'?'bg-white shadow text-blue-600':'text-gray-500'}`}>2. Vẽ</button>
            </div>
            
            <button onClick={() => mode==='calibrate'?setCalibPoints(p=>p.slice(0,-1)):setMeasurePoints(p=>p.slice(0,-1))} className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600" title="Hoàn tác"><Undo size={20}/></button>
            <button onClick={resetAll} className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold border border-red-100">
              <Trash2 size={18}/> <span className="hidden sm:inline">Xóa</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex justify-center items-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
        {!image ? (
          // --- MÀN HÌNH CHỌN ẢNH (HỖ TRỢ CAMERA) ---
          <div className="w-full max-w-md p-6 mx-4">
            <div className="bg-white p-8 rounded-3xl shadow-xl text-center border border-gray-100">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce">
                <Camera size={40} />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-gray-800">Bắt đầu đo đạc</h2>
              <p className="text-gray-500 mb-8 text-sm">Chọn ảnh từ thư viện hoặc chụp trực tiếp từ hiện trường.</p>
              
              <div className="flex flex-col gap-4">
                {/* NÚT 1: CHỤP ẢNH TRỰC TIẾP (CAMERA) */}
                <label className="group flex items-center justify-center gap-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl cursor-pointer transition-all shadow-lg shadow-blue-600/30 active:scale-95">
                  <Camera size={24} />
                  <span>Chụp Ảnh Mới</span>
                  {/* capture="environment" -> Bật camera sau ngay lập tức */}
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
                </label>

                {/* NÚT 2: TẢI TỪ THƯ VIỆN */}
                <label className="group flex items-center justify-center gap-3 w-full bg-white border-2 border-gray-200 hover:border-blue-300 text-gray-700 font-bold py-4 px-6 rounded-xl cursor-pointer transition-all hover:bg-gray-50 active:scale-95">
                  <ImageIcon size={24} />
                  <span>Chọn Từ Thư Viện</span>
                  {/* Không có capture -> Mở thư viện ảnh */}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div ref={containerRef} className={`w-full h-full relative ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}>
            <canvas 
              ref={canvasRef} 
              onMouseDown={handleMouseDown} 
              onMouseMove={handleMouseMove} 
              onMouseUp={() => setIsDragging(false)}
              onWheel={handleWheel}
              onContextMenu={e => e.preventDefault()}
              // Hỗ trợ touch trên mobile để không bị cuộn trang
              onTouchStart={(e) => { if(e.touches.length === 1) handleMouseDown({clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, button: 0}) }}
            />
            
            {/* Panel Hướng dẫn Mobile */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl text-sm border border-gray-100">
              <div className="flex gap-3 items-center">
                <div className="text-blue-500 bg-blue-50 p-2 rounded-full"><Info size={20} /></div>
                <div className="flex-1">
                  {mode === 'calibrate' && (
                    <>
                      <p className="font-bold text-red-600 mb-1">Bước 1: Cài Thước Đo</p>
                      <p className="text-gray-500 text-xs">Chấm 2 điểm vào một đoạn thẳng biết trước kích thước.</p>
                    </>
                  )}
                  {mode === 'measure' && (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-blue-600 mb-1">Bước 2: Vẽ Vùng</p>
                        <p className="text-gray-500 text-xs">Chấm các góc tường.</p>
                      </div>
                      <button onClick={calculateArea} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-xs shadow-lg">XONG</button>
                    </div>
                  )}
                  {mode === 'result' && (
                    <div className="text-center">
                      <p className="font-bold text-green-600 uppercase text-xs tracking-wider">Diện tích:</p>
                      <p className="text-3xl font-black text-gray-800 my-1">{calculatedArea?.toLocaleString('vi-VN', {maximumFractionDigits: 2})} m²</p>
                      <button onClick={() => {setMeasurePoints([]); setMode('measure'); setCalculatedArea(null);}} className="text-blue-600 underline text-xs font-bold mt-1">Đo tiếp</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Input Mobile-Friendly */}
      {showInputModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-xs animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-1 text-center text-gray-800">Nhập Kích Thước</h3>
            <p className="text-xs text-gray-500 mb-4 text-center">Đoạn màu đỏ dài bao nhiêu mét?</p>
            
            <div className="relative mb-6">
              <input 
                type="number" 
                inputMode="decimal"
                autoFocus 
                value={realDistance} 
                onChange={e => setRealDistance(e.target.value)} 
                placeholder="VD: 5.0" 
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-4 text-3xl font-mono text-center focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
              />
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => {setShowInputModal(false); setCalibPoints([]);}} className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-sm">Hủy</button>
              <button onClick={confirmCalibration} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/30">Xác Nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;