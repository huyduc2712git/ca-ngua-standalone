export function setupPWA({notify,isPlaying}){
  const button=document.querySelector('#install-app'),dialog=document.querySelector('#install-dialog'),content=document.querySelector('#install-content');
  let installPrompt=null,registration=null,offlineReady=false,updating=false;
  const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const ios=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  function updateButton(){button.querySelector('span:last-child').textContent=registration?.waiting?'Cập nhật':installed()?'Đã cài':'Cài game';button.classList.toggle('installed',installed());}
  function showInstall(){
    const secure=window.isSecureContext;
    content.innerHTML=`<div class="eyebrow">CÁ NGỰA TRÊN ĐIỆN THOẠI</div><h2>${installed()?'Game của bạn đã sẵn sàng':'Một chạm để vào cuộc đua'}</h2><div class="install-app-card"><img src="/pwa/icon-192.png" alt="Biểu tượng Cá Ngựa Club" width="64" height="64"><div><strong>Cá Ngựa Club</strong><p>Chơi 3D cùng hội bạn</p></div></div><div class="modal-copy">${!secure?'<p>Địa chỉ Wi-Fi hiện tại vẫn chơi được trên trình duyệt. Để cài game với chế độ offline, hãy mở bản HTTPS của host (ví dụ địa chỉ Render).</p>':installed()?'<p>Mở game từ biểu tượng trên màn hình chính. Chơi chung máy hoạt động offline sau khi tài nguyên đã tải xong; phòng nhiều máy cần kết nối tới host.</p>':ios()?'<p>Trên iPhone/iPad: mở menu <b>Chia sẻ</b>, chọn <b>Thêm vào Màn hình chính</b>, bật <b>Mở dưới dạng ứng dụng web</b> nếu có, rồi chọn <b>Thêm</b>.</p>':'<p>Chọn <b>Cài game</b> khi trình duyệt hiện lời mời cài đặt. Nếu chưa thấy, mở menu trình duyệt và chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào Màn hình chính</b>.</p>'}<p class="offline-ready">${offlineReady?'✓ Đã tải đủ tài nguyên để chơi chung máy offline.':secure?'Đang chuẩn bị tài nguyên offline. Giữ kết nối trong lần mở đầu.':'PWA cần HTTPS để lưu tài nguyên offline.'}</p></div>${installPrompt?'<button id="confirm-install" class="primary-button" style="margin-top:20px">Cài game</button>':''}${registration?.waiting?'<button id="apply-pwa-update" class="secondary-button" style="margin-top:15px">Cập nhật game</button>':''}`;
    if(!dialog.open)dialog.showModal();
    content.querySelector('#confirm-install')?.addEventListener('click',async()=>{const prompt=installPrompt;if(!prompt)return;installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted'){dialog.close();notify('Đang cài Cá Ngựa Club.');}updateButton();});
    content.querySelector('#apply-pwa-update')?.addEventListener('click',()=>{if(isPlaying()){notify('Kết thúc ván trước khi cập nhật để giữ cuộc đua liền mạch.');return;}updating=true;registration.waiting?.postMessage({type:'ACTIVATE_UPDATE'});});
  }
  button.addEventListener('click',showInstall);document.querySelector('#close-install').onclick=()=>dialog.close();
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;updateButton();});window.addEventListener('appinstalled',()=>{installPrompt=null;updateButton();notify('Đã cài Cá Ngựa Club.');});
  window.addEventListener('offline',()=>notify('Bạn đang offline. Chơi chung máy vẫn hoạt động.'));updateButton();
  if(!('serviceWorker'in navigator)||!window.isSecureContext)return;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)location.reload();});
  navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(async reg=>{
    registration=reg;reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){updateButton();if(navigator.serviceWorker.controller)notify('Có phiên bản mới. Cập nhật sau khi kết thúc ván.');}});});
    await navigator.serviceWorker.ready;offlineReady=true;updateButton();
    if(dialog.open)showInstall();
  }).catch(()=>notify('Chưa lưu được chế độ offline. Game vẫn có thể chơi khi đang kết nối.'));
}
