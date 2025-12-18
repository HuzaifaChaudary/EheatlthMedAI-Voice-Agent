Mobile App SDK for EHealth Med AI

Overview

The Mobile App SDK allows healthcare organizations to integrate EHealth Med AI voice agents into their native iOS and Android mobile applications. The SDK provides a complete interface for real-time voice interactions, text messaging, and conversation management.

Supported Platforms

iOS (Swift) - Version 12.0 and above
Android (Kotlin/Java) - API Level 21 (Android 5.0) and above
React Native - Version 0.60 and above (Coming Soon)
Flutter - Version 2.0 and above (Coming Soon)

Installation

iOS (Swift)

Add the SDK to your Podfile:

pod 'EHealthMedAI', '~> 1.0.0'

Or install via Swift Package Manager:

Add package: https://github.com/your-org/ehealth-medai-ios-sdk

Android (Kotlin/Java)

Add to your build.gradle (Module: app):

dependencies {
    implementation 'com.ehealthmedai:sdk:1.0.0'
}

Or via Maven:

<dependency>
    <groupId>com.ehealthmedai</groupId>
    <artifactId>sdk</artifactId>
    <version>1.0.0</version>
</dependency>

Initialization

iOS (Swift)

import EHealthMedAI

let config = SDKConfig(
    apiKey: "YOUR_API_KEY",
    apiUrl: "https://api.ehealthmedai.com",
    organizationId: "YOUR_ORG_ID"
)

EHealthMedAI.initialize(config: config)

Android (Kotlin)

import com.ehealthmedai.sdk.EHealthMedAI
import com.ehealthmedai.sdk.config.SDKConfig

val config = SDKConfig(
    apiKey = "YOUR_API_KEY",
    apiUrl = "https://api.ehealthmedai.com",
    organizationId = "YOUR_ORG_ID"
)

EHealthMedAI.initialize(config)

Usage

Voice Conversation

iOS (Swift)

let agentId = 123
let conversation = EHealthMedAI.shared.createVoiceConversation(agentId: agentId)

conversation.start { result in
    switch result {
    case .success(let conversationId):
        print("Conversation started: \(conversationId)")
        // Start voice input
        conversation.startListening { response in
            print("AI Response: \(response.text)")
            // Play audio response if available
            if let audioData = response.audio {
                conversation.playAudio(audioData)
            }
        }
    case .failure(let error):
        print("Error: \(error.localizedDescription)")
    }
}

// Stop conversation
conversation.stop()

Android (Kotlin)

val agentId = 123
val conversation = EHealthMedAI.shared.createVoiceConversation(agentId)

conversation.start(object : ConversationCallback {
    override fun onSuccess(conversationId: Int) {
        Log.d("EHealthMedAI", "Conversation started: $conversationId")
        // Start voice input
        conversation.startListening(object : VoiceResponseCallback {
            override fun onResponse(response: VoiceResponse) {
                Log.d("EHealthMedAI", "AI Response: ${response.text}")
                // Play audio response if available
                response.audio?.let { audioData ->
                    conversation.playAudio(audioData)
                }
            }
            
            override fun onError(error: Throwable) {
                Log.e("EHealthMedAI", "Error: ${error.message}")
            }
        })
    }
    
    override fun onError(error: Throwable) {
        Log.e("EHealthMedAI", "Error: ${error.localizedDescription}")
    }
})

// Stop conversation
conversation.stop()

Text Chat

iOS (Swift)

let chat = EHealthMedAI.shared.createTextChat(agentId: agentId)

chat.sendMessage("Hello, I need to schedule an appointment") { result in
    switch result {
    case .success(let response):
        print("Response: \(response.text)")
    case .failure(let error):
        print("Error: \(error.localizedDescription)")
    }
}

Android (Kotlin)

val chat = EHealthMedAI.shared.createTextChat(agentId)

chat.sendMessage("Hello, I need to schedule an appointment", object : ChatCallback {
    override fun onSuccess(response: ChatResponse) {
        Log.d("EHealthMedAI", "Response: ${response.text}")
    }
    
    override fun onError(error: Throwable) {
        Log.e("EHealthMedAI", "Error: ${error.message}")
    }
})

Permissions

iOS

Add to Info.plist:

<key>NSMicrophoneUsageDescription</key>
<string>We need access to your microphone for voice interactions with the AI assistant.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>We need speech recognition access to convert your voice to text.</string>

Android

Add to AndroidManifest.xml:

<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

Request permissions at runtime:

// Android
if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) 
    != PackageManager.PERMISSION_GRANTED) {
    ActivityCompat.requestPermissions(
        activity,
        arrayOf(Manifest.permission.RECORD_AUDIO),
        REQUEST_CODE_AUDIO
    )
}

HIPAA Compliance

The SDK is designed with HIPAA compliance in mind:

All communications are encrypted using TLS 1.2 or higher
Audio data is encrypted in transit
Conversations are stored securely with encryption at rest
Consent is required before recording conversations
All data is handled according to BAA agreements

Error Handling

iOS (Swift)

conversation.start { result in
    switch result {
    case .success(let conversationId):
        // Handle success
    case .failure(let error):
        switch error {
        case .networkError:
            // Handle network error
        case .authenticationError:
            // Handle auth error
        case .agentNotFound:
            // Handle agent not found
        case .permissionDenied:
            // Handle permission denied
        default:
            // Handle other errors
        }
    }
}

Android (Kotlin)

conversation.start(object : ConversationCallback {
    override fun onSuccess(conversationId: Int) {
        // Handle success
    }
    
    override fun onError(error: Throwable) {
        when (error) {
            is NetworkException -> {
                // Handle network error
            }
            is AuthenticationException -> {
                // Handle auth error
            }
            is AgentNotFoundException -> {
                // Handle agent not found
            }
            is PermissionDeniedException -> {
                // Handle permission denied
            }
            else -> {
                // Handle other errors
            }
        }
    }
})

Configuration Options

SDKConfig Parameters:

apiKey (required): Your organization API key
apiUrl (optional): API endpoint URL (default: https://api.ehealthmedai.com)
organizationId (required): Your organization ID
enableLogging (optional): Enable debug logging (default: false)
enableMetrics (optional): Enable usage metrics (default: true)
enableOfflineMode (optional): Enable offline message queue (default: false)

Future Enhancements

React Native SDK
Flutter SDK
Offline mode with message queue
Push notifications for conversation updates
Widget components for easy UI integration
Background conversation support
Custom UI themes
Multi-language support

API Reference

Full API documentation available at:
https://docs.ehealthmedai.com/mobile-sdk

Support

For SDK support, please contact:
Email: sdk-support@ehealthmedai.com
Documentation: https://docs.ehealthmedai.com
GitHub: https://github.com/your-org/ehealth-medai-sdk

