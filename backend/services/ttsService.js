/**
 * Text-to-Speech Service
 * Supports multiple TTS providers including ElevenLabs
 */

const https = require('https');
const http = require('http');

class TTSService {
  constructor() {
    this.providers = {
      elevenlabs: this.elevenlabsSynthesize.bind(this),
      google: this.googleSynthesize.bind(this),
      aws: this.awsSynthesize.bind(this),
      azure: this.azureSynthesize.bind(this)
    };
  }

  /**
   * Synthesize speech using the configured provider
   */
  async synthesize(text, config) {
    const { provider, voice_id, voice_name, language_code, speaking_rate, pitch, volume_gain_db, config: providerConfig } = config;

    if (!this.providers[provider]) {
      throw new Error(`Unsupported TTS provider: ${provider}`);
    }

    try {
      const audioData = await this.providers[provider](text, {
        voice_id,
        voice_name,
        language_code,
        speaking_rate,
        pitch,
        volume_gain_db,
        ...providerConfig
      });

      return {
        success: true,
        audio: audioData,
        format: 'audio/mpeg',
        provider
      };
    } catch (error) {
      console.error(`TTS synthesis error (${provider}):`, error);
      throw error;
    }
  }

  /**
   * ElevenLabs TTS synthesis
   */
  async elevenlabsSynthesize(text, options = {}) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key is not configured');
    }

    const voiceId = options.voice_id || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default voice
    const modelId = options.model_id || 'eleven_monolingual_v1';
    const stability = options.stability !== undefined ? options.stability : 0.5;
    const similarity_boost = options.similarity_boost !== undefined ? options.similarity_boost : 0.75;
    const style = options.style !== undefined ? options.style : 0.0;
    const use_speaker_boost = options.use_speaker_boost !== undefined ? options.use_speaker_boost : true;

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const data = JSON.stringify({
      text: text,
      model_id: modelId,
      voice_settings: {
        stability: stability,
        similarity_boost: similarity_boost,
        style: style,
        use_speaker_boost: use_speaker_boost
      }
    });

    return new Promise((resolve, reject) => {
      const options = {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        }
      };

      https.request(url, options, (res) => {
        if (res.statusCode !== 200) {
          let errorData = '';
          res.on('data', (chunk) => {
            errorData += chunk;
          });
          res.on('end', () => {
            try {
              const error = JSON.parse(errorData);
              reject(new Error(error.detail?.message || `ElevenLabs API error: ${res.statusCode}`));
            } catch (e) {
              reject(new Error(`ElevenLabs API error: ${res.statusCode}`));
            }
          });
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          const audioBuffer = Buffer.concat(chunks);
          resolve(audioBuffer.toString('base64'));
        });
      }).on('error', (error) => {
        reject(new Error(`ElevenLabs request failed: ${error.message}`));
      }).end(data);
    });
  }

  /**
   * Get available ElevenLabs voices
   */
  async getElevenLabsVoices() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key is not configured');
    }

    const url = 'https://api.elevenlabs.io/v1/voices';

    return new Promise((resolve, reject) => {
      const options = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': apiKey
        }
      };

      https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            try {
              const error = JSON.parse(data);
              reject(new Error(error.detail?.message || `ElevenLabs API error: ${res.statusCode}`));
            } catch (e) {
              reject(new Error(`ElevenLabs API error: ${res.statusCode}`));
            }
            return;
          }

          try {
            const response = JSON.parse(data);
            resolve(response.voices || []);
          } catch (e) {
            reject(new Error('Failed to parse ElevenLabs voices response'));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`ElevenLabs request failed: ${error.message}`));
      }).end();
    });
  }

  /**
   * Google TTS synthesis (placeholder)
   */
  async googleSynthesize(text, options = {}) {
    // TODO: Implement Google TTS
    throw new Error('Google TTS not yet implemented');
  }

  /**
   * AWS Polly TTS synthesis (placeholder)
   */
  async awsSynthesize(text, options = {}) {
    // TODO: Implement AWS Polly TTS
    throw new Error('AWS Polly TTS not yet implemented');
  }

  /**
   * Azure TTS synthesis (placeholder)
   */
  async azureSynthesize(text, options = {}) {
    // TODO: Implement Azure TTS
    throw new Error('Azure TTS not yet implemented');
  }
}

module.exports = new TTSService();

