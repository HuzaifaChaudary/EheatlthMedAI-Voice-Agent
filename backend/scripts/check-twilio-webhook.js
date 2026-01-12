/**
 * Check and Fix Twilio Webhook URLs
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const CORRECT_BASE_URL = 'https://ehealthmed.ai';

async function checkAndFixWebhooks() {
  console.log('🔍 Checking Twilio webhook configuration...\n');
  
  try {
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: '+14047387870' });
    
    if (numbers.length === 0) {
      console.log('❌ Phone number +14047387870 not found in Twilio account');
      return;
    }
    
    const num = numbers[0];
    console.log('📞 Phone Number:', num.phoneNumber);
    console.log('   SID:', num.sid);
    console.log('   Current Voice URL:', num.voiceUrl || 'NOT SET');
    console.log('   Current Voice Method:', num.voiceMethod || 'NOT SET');
    console.log('   Current Status Callback:', num.statusCallback || 'NOT SET');
    console.log('   Current SMS URL:', num.smsUrl || 'NOT SET');
    
    // Check if URLs are correct
    const correctVoiceUrl = `${CORRECT_BASE_URL}/api/telephony/twilio/inbound`;
    const correctStatusCallback = `${CORRECT_BASE_URL}/api/telephony/twilio/status`;
    const correctSmsUrl = `${CORRECT_BASE_URL}/api/telephony/twilio/sms`;
    
    const needsUpdate = 
      num.voiceUrl !== correctVoiceUrl || 
      num.statusCallback !== correctStatusCallback;
    
    if (needsUpdate) {
      console.log('\n⚠️  URLs need to be updated!');
      console.log('   Correct Voice URL:', correctVoiceUrl);
      console.log('   Correct Status Callback:', correctStatusCallback);
      
      console.log('\n🔧 Updating Twilio webhook URLs...');
      
      await client.incomingPhoneNumbers(num.sid).update({
        voiceUrl: correctVoiceUrl,
        voiceMethod: 'POST',
        statusCallback: correctStatusCallback,
        statusCallbackMethod: 'POST',
        smsUrl: correctSmsUrl,
        smsMethod: 'POST'
      });
      
      console.log('✅ Webhook URLs updated successfully!');
      
      // Verify update
      const updated = await client.incomingPhoneNumbers(num.sid).fetch();
      console.log('\n📋 Updated configuration:');
      console.log('   Voice URL:', updated.voiceUrl);
      console.log('   Status Callback:', updated.statusCallback);
      console.log('   SMS URL:', updated.smsUrl);
    } else {
      console.log('\n✅ Webhook URLs are already correct!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAndFixWebhooks();

