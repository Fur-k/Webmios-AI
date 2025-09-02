<?php
// Android cihazlar için gelişmiş CORS yapılandırması
header('Content-Type: text/plain; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
header('Access-Control-Max-Age: 86400');

// OPTIONS preflight request için - Android tarayıcıları bunu gönderiyor
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Error reporting (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);

// Check if request method is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo 'Method Not Allowed';
    exit;
}

// Get the message from POST data
$message = isset($_POST['message']) ? trim($_POST['message']) : '';
$imageData = isset($_POST['image']) ? $_POST['image'] : null;
$hasImage = isset($_POST['hasImage']) ? $_POST['hasImage'] === 'true' : false;

// Görsel dosyası varsa işle (FormData'dan gelen blob)
if (!$hasImage && isset($_FILES['image'])) {
    $uploadedFile = $_FILES['image'];
    
    if ($uploadedFile['error'] === UPLOAD_ERR_OK) {
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (in_array($uploadedFile['type'], $allowedTypes)) {
            if ($uploadedFile['size'] <= 5 * 1024 * 1024) { // 5MB limit
                $imageData = 'data:' . $uploadedFile['type'] . ';base64,' . base64_encode(file_get_contents($uploadedFile['tmp_name']));
                $hasImage = true;
            }
        }
    }
}

if (empty($message) && !$hasImage) {
    echo 'Lütfen bir mesaj yazın veya görsel yükleyin.';
    exit;
}

// Sanitize input
if (!empty($message)) {
    $message = filter_var($message, FILTER_SANITIZE_STRING);
    $message = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    
    // Length check
    if (strlen($message) > 500) {
        echo 'Mesaj çok uzun. Lütfen daha kısa bir mesaj yazın.';
        exit;
    }
}

try {
    // OpenRouter API configuration
    $apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    $apiKey = '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';

    // ✅ Düzeltilmiş sistem prompt - Sadece direkt kimlik sorularında cevap ver
    $systemPrompt = "Sen yardımsever bir yapay zeka asistanısın. 

SADECE kullanıcı sana doğrudan 'Sen kimsin?', 'İsmin ne?', 'Hangi şirket seni yaptı?' gibi kimlik soruları sorduğunda şu bilgileri ver:
- İsmin: WebMios AI
- Geliştirici: WebMios şirketi
- Kurucu: Furkan Çelik

Bu bilgileri SADECE direkt kimlik soruları geldiğinde paylaş. Diğer hiçbir konuşmada bu bilgileri kendiliğinden söyleme.

Normal sorularda sadece yardımcı ol, kimlik bilgilerini belirtme. Görseller analiz et, sorulara detaylı cevap ver.";

    // Prepare messages array
    $messages = [
        [
            'role' => 'system',
            'content' => $systemPrompt
        ]
    ];

    // Add user message with or without image
    if ($hasImage && $imageData) {
        $userMessage = [
            'role' => 'user',
            'content' => [
                [
                    'type' => 'text',
                    'text' => $message ?: 'Bu görseli analiz eder misin?'
                ],
                [
                    'type' => 'image_url',
                    'image_url' => [
                        'url' => $imageData
                    ]
                ]
            ]
        ];
    } else {
        $userMessage = [
            'role' => 'user',
            'content' => $message
        ];
    }

    $messages[] = $userMessage;

    // Model seçimi - Android uyumluluğu için stabile model
    $model = $hasImage ? 'anthropic/claude-3-haiku:beta' : 'anthropic/claude-3-haiku';

    // API isteği hazırlanıyor
    $postData = json_encode([
        'model' => $model,
        'messages' => $messages,
        'max_tokens' => 1500,
        'temperature' => 0.7,
        'top_p' => 0.9,
        'stream' => false
    ], JSON_UNESCAPED_UNICODE);

    // cURL başlatma - Android uyumluluğu için optimize edildi
    $ch = curl_init();
    
    // Android uyumlu cURL seçenekleri
    curl_setopt_array($ch, [
        CURLOPT_URL => $apiUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postData,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json; charset=utf-8',
            'Authorization: Bearer ' . $apiKey,
            'HTTP-Referer: https://demirtasdekorasyon.online',
            'X-Title: WebMios AI',
            'User-Agent: Mozilla/5.0 (compatible; WebMios-AI/1.0)',
            'Accept: application/json',
            'Accept-Encoding: gzip, deflate',
            'Connection: close'
        ],
        CURLOPT_TIMEOUT => 60,           // Timeout artırıldı Android için
        CURLOPT_CONNECTTIMEOUT => 30,    // Connection timeout artırıldı
        CURLOPT_SSL_VERIFYPEER => false, // Android SSL sorunları için
        CURLOPT_SSL_VERIFYHOST => 0,     // Android SSL sorunları için
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_ENCODING => '',          // Automatic decompression
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36',
        CURLOPT_FRESH_CONNECT => false,  // Allow connection reuse
        CURLOPT_FORBID_REUSE => false    // Allow connection reuse
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    $curlErrno = curl_errno($ch);
    
    curl_close($ch);

    // cURL hata kontrolü - detaylı Android hata yönetimi
    if ($curlError || $curlErrno !== 0) {
        error_log('cURL Error: ' . $curlError . ' (Code: ' . $curlErrno . ')');
        
        // Android özel hata mesajları
        if ($curlErrno === 6) { // CURLE_COULDNT_RESOLVE_HOST
            throw new Exception('İnternet bağlantınızı kontrol edin.');
        } elseif ($curlErrno === 7) { // CURLE_COULDNT_CONNECT
            throw new Exception('Sunucuya bağlanılamıyor. Lütfen tekrar deneyin.');
        } elseif ($curlErrno === 28) { // CURLE_OPERATION_TIMEDOUT
            throw new Exception('İstek zaman aşımına uğradı. Tekrar deneyin.');
        } elseif ($curlErrno === 35 || $curlErrno === 60) { // SSL errors
            throw new Exception('Güvenli bağlantı hatası. Tekrar deneyin.');
        } else {
            throw new Exception('Bağlantı hatası oluştu. Lütfen tekrar deneyin.');
        }
    }

    // Response kontrolü
    if ($response === false) {
        throw new Exception('Sunucudan yanıt alınamadı. Tekrar deneyin.');
    }

    // HTTP status code kontrolü
    if ($httpCode !== 200) {
        error_log('HTTP Error: ' . $httpCode . ' - Response: ' . substr($response, 0, 500));
        
        if ($httpCode >= 500) {
            throw new Exception('Sunucu geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
        } elseif ($httpCode === 429) {
            throw new Exception('Çok fazla istek gönderildi. Lütfen biraz bekleyin.');
        } elseif ($httpCode === 401 || $httpCode === 403) {
            throw new Exception('Yetkilendirme hatası. Lütfen daha sonra tekrar deneyin.');
        } elseif ($httpCode === 400) {
            throw new Exception('Geçersiz istek. Lütfen mesajınızı kontrol edin.');
        } else {
            throw new Exception('API hatası oluştu (HTTP ' . $httpCode . '). Lütfen tekrar deneyin.');
        }
    }

    // JSON parse - UTF-8 encoding kontrolü
    $responseData = json_decode($response, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('JSON Parse Error: ' . json_last_error_msg() . ' - Response: ' . substr($response, 0, 500));
        
        // Try to clean response for Android
        $cleanResponse = preg_replace('/[\x00-\x1F\x80-\xFF]/', '', $response);
        $responseData = json_decode($cleanResponse, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Yanıt işlenirken hata oluştu. Lütfen tekrar deneyin.');
        }
    }

    // Response kontrolü ve çıkarma
    $aiResponse = '';
    
    if (isset($responseData['choices'][0]['message']['content'])) {
        $aiResponse = $responseData['choices'][0]['message']['content'];
    } elseif (isset($responseData['response'])) {
        $aiResponse = $responseData['response'];
    } elseif (isset($responseData['text'])) {
        $aiResponse = $responseData['text'];
    } elseif (isset($responseData['error'])) {
        // API error response
        $errorMsg = isset($responseData['error']['message']) ? $responseData['error']['message'] : 'API hatası';
        error_log('API Error Response: ' . $errorMsg);
        
        // Specific API error handling
        if (strpos($errorMsg, 'rate limit') !== false) {
            throw new Exception('Çok fazla istek gönderildi. Lütfen bekleyin.');
        } elseif (strpos($errorMsg, 'invalid') !== false) {
            throw new Exception('Geçersiz istek. Lütfen tekrar deneyin.');
        } else {
            throw new Exception('Servis geçici olarak kullanılamıyor. Tekrar deneyin.');
        }
    } else {
        error_log('Unexpected Response Format: ' . substr($response, 0, 500));
        throw new Exception('Beklenmeyen yanıt formatı. Lütfen tekrar deneyin.');
    }

    // Response temizleme ve kontrol
    $aiResponse = trim($aiResponse);
    
    // Remove excessive whitespace but preserve line breaks
    $aiResponse = preg_replace('/[ \t]+/', ' ', $aiResponse);
    $aiResponse = preg_replace('/\n\s*\n\s*\n/', "\n\n", $aiResponse);
    
    // Boş yanıt kontrolü
    if (empty($aiResponse)) {
        throw new Exception('Boş yanıt alındı. Lütfen tekrar deneyin.');
    }

    // UTF-8 encoding kontrolü
    if (!mb_check_encoding($aiResponse, 'UTF-8')) {
        $aiResponse = mb_convert_encoding($aiResponse, 'UTF-8', 'auto');
    }

    // Başarılı yanıt
    echo $aiResponse;

} catch (Exception $e) {
    // Error logging
    error_log('WebMios AI Error: ' . $e->getMessage() . ' - Time: ' . date('Y-m-d H:i:s') . ' - User Agent: ' . ($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'));
    
    // Kullanıcı dostu hata mesajı
    $errorMessage = $e->getMessage();
    
    // Android özel hata mesajları
    if (strpos($_SERVER['HTTP_USER_AGENT'] ?? '', 'Android') !== false) {
        if (strpos($errorMessage, 'Connection') !== false || strpos($errorMessage, 'timeout') !== false) {
            echo 'Android cihazınızda bağlantı sorunu var. WiFi veya mobil verilerinizi kontrol edin.';
        } elseif (strpos($errorMessage, 'SSL') !== false || strpos($errorMessage, 'certificate') !== false) {
            echo 'Güvenlik sertifikası sorunu. Lütfen tekrar deneyin.';
        } else {
            echo $errorMessage;
        }
    } else {
        // Genel hata mesajları
        if (strpos($errorMessage, 'Connection') !== false || strpos($errorMessage, 'timeout') !== false) {
            echo 'Bağlantı sorunu yaşanıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.';
        } else {
            echo $errorMessage;
        }
    }
}
?>