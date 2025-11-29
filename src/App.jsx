import React, { useState, useRef, useEffect } from 'react';
import { Upload, Ruler, Undo, ZoomIn, ZoomOut, Info, Trash2, CheckCircle, MousePointer2 } from 'lucide-react';

const App = () => {
  // --- STATE QUẢN LÝ DỮ LIỆU ---
  const [image, setImage] = useState(null);
  const [mode, setMode] = useState('upload'); // 'upload', 'calibrate', 'measure', 'result'
  
  // Zoom/Pan (Phóng to/Di chuyển)
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Dữ liệu đo đạc
  const [calibPoints, setCalibPoints] = useState([]); // Điểm mốc tỷ lệ
  const [measurePoints, setMeasurePoints] = useState([]); // Điểm vẽ vùng
  const [realDistance, setRealDistance] = useState(''); // Độ dài thực tế nhập vào
  const [pixelsPerMeter, setPixelsPerMeter] = useState(null); // Tỷ lệ quy đổi
  const [calculatedArea, setCalculatedArea] = useState(null); // Kết quả

  // Giao diện
  const [showInputModal, setShowInputModal] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // --- 1. XỬ LÝ ẢNH ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setMode('calibrate');
          // Reset góc nhìn về mặc định
          setScale(1);
          setOffset({ x: 0, y: 0 });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // --- 2. VẼ LÊN CANVAS ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    // Set kích thước canvas bằng khung chứa
    canvas.width = containerRef.current.clientWidth;
    canvas.height = containerRef.current.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    // Áp dụng Zoom & Pan
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // a. Vẽ ảnh gốc
    ctx.drawImage(image, 0, 0);

    // Hàm vẽ điểm tròn
    const drawPoint = (x, y, color) => {
      ctx.beginPath();
      ctx.arc(x, y, 6 / scale, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
    };

    // b. Vẽ đường Calibrate (Màu Đỏ)
    if (calibPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(calibPoints[0].x, calibPoints[0].y);
      if (calibPoints.length > 1) {
        ctx.lineTo(calibPoints[1].x, calibPoints[1].y);
      } else {
        // Vẽ đường nét đứt theo con trỏ chuột
        const mouseImgPos = screenToImage(cursorPos.x, cursorPos.y);
        ctx.lineTo(mouseImgPos.x, mouseImgPos.y);
      }
      ctx.strokeStyle = '#ef4444'; 
      ctx.lineWidth = 3 / scale;
      ctx.stroke();
      calibPoints.forEach(p => drawPoint(p.x, p.y, '#ef4444'));
    }

    // c. Vẽ đường Measure (Màu Xanh)
    if (measurePoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(measurePoints[0].x, measurePoints[0].y);
      measurePoints.forEach((p, index) => {
        if (index > 0) ctx.lineTo(p.x, p.y);
      });
      
      // Vẽ đường preview theo chuột nếu đang đo
      if (mode === 'measure') {
        const mouseImgPos = screenToImage(cursorPos.x, cursorPos.y);
        ctx.lineTo(mouseImgPos.x, mouseImgPos.y);
      }

      ctx.strokeStyle = '#3b82f6'; 
      ctx.lineWidth = 3 / scale;
      ctx.stroke();
      
      // Tô màu vùng đã chọn
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fill();
      
      measurePoints.forEach(p => drawPoint(p.x, p.y, '#3b82f6'));
    }
    ctx.restore();
  }, [image, scale, offset, calibPoints, measurePoints, cursorPos, mode]);

  // --- 3. HỆ TỌA ĐỘ ---
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
    const newScale = Math.min(Math.max(0.1, scale * factor), 20); // Giới hạn zoom từ 0.1x đến 20x
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Tính offset mới để zoom đúng chỗ con trỏ
    const newOffset = {
      x: mouseX - (mouseX - offset.x) * (newScale / scale),
      y: mouseY - (mouseY - offset.y) * (newScale / scale)
    };
    setScale(newScale);
    setOffset(newOffset);
  };

  const handleMouseDown = (e) => {
    // Kéo ảnh (Pan) bằng chuột giữa hoặc giữ Shift
    if (e.button === 1 || e.shiftKey) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }
    
    // Logic click điểm
    const { x, y } = screenToImage(e.clientX, e.clientY);
    
    if (mode === 'calibrate') {
      if (calibPoints.length < 2) {
        const newPoints = [...calibPoints, { x, y }];
        setCalibPoints(newPoints);
        // Nếu đã chọn đủ 2 điểm -> Hiện bảng nhập số
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

  // --- 4. TÍNH TOÁN ---
  const confirmCalibration = () => {
    if (!realDistance || isNaN(realDistance) || parseFloat(realDistance) <= 0) {
      alert("Vui lòng nhập khoảng cách đúng (số dương)!");
      return;
    }
    // Tính khoảng cách pixel giữa 2 điểm đỏ
    const distPx = Math.sqrt(Math.pow(calibPoints[1].x - calibPoints[0].x, 2) + Math.pow(calibPoints[1].y - calibPoints[0].y, 2));
    // Tính tỷ lệ: 1 mét = bao nhiêu pixel
    setPixelsPerMeter(distPx / parseFloat(realDistance));
    
    setShowInputModal(false);
    setMode('measure'); // Chuyển sang chế độ đo luôn
  };

  const calculateArea = () => {
    if (measurePoints.length < 3) return alert("Cần ít nhất 3 điểm để tạo thành vùng kín!");
    if (!pixelsPerMeter) return alert("Chưa thiết lập tỷ lệ!");

    // Công thức Shoelace để tính diện tích đa giác
    let area = 0;
    const n = measurePoints.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += measurePoints[i].x * measurePoints[j].y;
      area -= measurePoints[j].x * measurePoints[i].y;
    }
    area = Math.abs(area) / 2;
    
    // Quy đổi ra m2
    setCalculatedArea(area / Math.pow(pixelsPerMeter, 2));
    setMode('result');
  };

  const resetAll = () => {
    setImage(null); setMode('upload');
    setCalibPoints([]); setMeasurePoints([]);
    setPixelsPerMeter(null); setCalculatedArea(null); setRealDistance('');
  };

  // --- 5. GIAO DIỆN (HTML) ---
  return (
    <div className="flex flex-col h-screen text-gray-800 font-sans bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-3 flex justify-between items-center z-10 shrink-0 h-16 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Ruler size={24} /></div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight hidden sm:block">Đo Diện Tích Online</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Công cụ chuyên nghiệp</p>
          </div>
        </div>
        
        {image && (
          <div className="flex gap-3 items-center">
            {/* Thanh công cụ chính */}
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button 
                onClick={() => {setMode('calibrate'); setCalibPoints([]);}} 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${mode==='calibrate'?'bg-white shadow-sm text-red-600 ring-1 ring-black/5':'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
              >
                <span className="w-5 h-5 flex items-center justify-center bg-current text-white rounded-full text-xs opacity-20">1</span>
                Thiết Lập Tỷ Lệ
              </button>
              <div className="w-px bg-gray-300 my-1 mx-1"></div>
              <button 
                onClick={() => {if(!pixelsPerMeter) return alert('Cần chỉnh tỷ lệ trước'); setMode('measure'); setMeasurePoints([]); setCalculatedArea(null);}} 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${mode==='measure'?'bg-white shadow-sm text-blue-600 ring-1 ring-black/5':'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
              >
                <span className="w-5 h-5 flex items-center justify-center bg-current text-white rounded-full text-xs opacity-20">2</span>
                Vẽ Vùng Đo
              </button>
            </div>
            
            <div className="h-8 w-px bg-gray-300 mx-1"></div>

            <div className="flex gap-1">
              <button onClick={() => mode==='calibrate'?setCalibPoints(p=>p.slice(0,-1)):setMeasurePoints(p=>p.slice(0,-1))} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition-all border border-transparent hover:border-gray-200" title="Hoàn tác"><Undo size={20}/></button>
              <button onClick={() => setScale(s => s * 1.2)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition-all border border-transparent hover:border-gray-200" title="Phóng to"><ZoomIn size={20}/></button>
              <button onClick={() => setScale(s => s / 1.2)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-600 transition-all border border-transparent hover:border-gray-200" title="Thu nhỏ"><ZoomOut size={20}/></button>
            </div>
            
            <button onClick={resetAll} className="ml-2 flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors border border-red-100">
              <Trash2 size={16}/> Xóa
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex justify-center items-center bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
        {!image ? (
          // Màn hình Upload
          <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md mx-4 border border-gray-100 transform transition-all hover:scale-[1.01]">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner"><Upload size={40} /></div>
            <h2 className="text-2xl font-bold mb-3 text-gray-800">Tải Bản Vẽ Lên</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">Hỗ trợ định dạng JPG, PNG. Hãy tải bản vẽ mặt bằng của bạn lên để bắt đầu đo đạc chính xác.</p>
            <label className="group block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl cursor-pointer transition-all shadow-lg shadow-blue-600/30 active:scale-95">
              <span className="flex items-center justify-center gap-2">
                <Upload size={20} className="group-hover:animate-bounce"/> Chọn File Ảnh
              </span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>
        ) : (
          // Màn hình Canvas
          <div ref={containerRef} className={`w-full h-full relative ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}>
            <canvas 
              ref={canvasRef} 
              onMouseDown={handleMouseDown} 
              onMouseMove={handleMouseMove} 
              onMouseUp={() => setIsDragging(false)}
              onWheel={handleWheel}
              onContextMenu={e => e.preventDefault()}
            />
            
            {/* Panel Hướng dẫn */}
            <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-2xl text-sm max-w-xs border border-gray-100 animate-in slide-in-from-bottom-5 duration-500 pointer-events-none select-none">
              <div className="flex gap-4">
                <div className="text-blue-500 mt-1"><Info size={20} /></div>
                <div>
                  {mode === 'calibrate' && (
                    <>
                      <p className="font-bold text-red-600 mb-2 text-base flex items-center gap-2">
                        Bước 1: Cài Thước Đo
                      </p>
                      <p className="text-gray-600 leading-relaxed mb-1">Hãy zoom to đến một kích thước bạn biết rõ (ví dụ cửa đi 0.9m).</p>
                      <p className="text-gray-500 text-xs italic">👉 Click chuột vào điểm đầu và điểm cuối của đoạn đó.</p>
                    </>
                  )}
                  {mode === 'measure' && (
                    <>
                      <p className="font-bold text-blue-600 mb-2 text-base flex items-center gap-2">
                         Bước 2: Vẽ Vùng Cần Đo
                      </p>
                      <p className="text-gray-600 mb-4 leading-relaxed">Click lần lượt vào các góc tường để bao quanh khu vực bạn muốn tính diện tích.</p>
                      <button onClick={calculateArea} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 pointer-events-auto">
                        <CheckCircle size={18}/> KẾT THÚC & TÍNH
                      </button>
                    </>
                  )}
                  {mode === 'result' && (
                    <>
                      <p className="font-bold text-green-600 uppercase text-xs tracking-wider mb-1">Kết quả diện tích:</p>
                      <p className="text-4xl font-black text-gray-800 my-2 tracking-tight">{calculatedArea?.toLocaleString('vi-VN', {maximumFractionDigits: 2})} <span className="text-lg font-normal text-gray-500">m²</span></p>
                      <div className="h-px bg-gray-200 my-3"></div>
                      <button onClick={() => {setMeasurePoints([]); setMode('measure'); setCalculatedArea(null);}} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium w-full justify-center pointer-events-auto">
                        <MousePointer2 size={16}/> Đo vùng khác
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Thông báo chế độ Pan */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-1.5 rounded-full text-xs backdrop-blur-sm pointer-events-none">
              Mẹo: Giữ phím <b>Shift</b> hoặc chuột giữa để kéo ảnh
            </div>
          </div>
        )}
      </main>

      {/* Modal Input (Bảng nhập số liệu) */}
      {showInputModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm transform transition-all scale-100 border border-gray-100">
            <h3 className="text-xl font-bold mb-3 text-gray-900">Nhập Độ Dài Thực Tế</h3>
            <p className="text-sm text-gray-500 mb-6">Đoạn màu đỏ bạn vừa vẽ dài bao nhiêu mét ngoài đời?</p>
            
            <div className="relative mb-6">
              <input 
                type="number" 
                autoFocus 
                value={realDistance} 
                onChange={e => setRealDistance(e.target.value)} 
                placeholder="Ví dụ: 5.0" 
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-2xl font-mono text-center focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                onKeyDown={(e) => e.key === 'Enter' && confirmCalibration()}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">mét</span>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button onClick={() => {setShowInputModal(false); setCalibPoints([]);}} className="flex-1 px-5 py-3 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">Hủy</button>
              <button onClick={confirmCalibration} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all active:scale-95">Xác Nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;