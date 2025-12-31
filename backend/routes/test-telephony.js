/**
 * Test Telephony Routes
 * Auto-answer endpoints for testing calls without human interaction
 */

const express = require('express');
const router = express.Router();

/**
 * Auto-answer endpoint for testing
 * This endpoint will automatically answer and play a message
 * Use this as the webhook URL for a test Twilio number
 */
router.post('/auto-answer', (req, res) => {
  const twilio = require('twilio');
  const response = new twilio.twiml.VoiceResponse();
  
  // Auto-answer and play a test message
  response.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Hello! This is a test call from your clinic system. Your appointment booking system is working correctly. This call will now end. Thank you!');
  
  // Hang up after message
  response.hangup();
  
  res.type('text/xml');
  res.send(response.toString());
});

/**
 * Auto-answer with appointment confirmation message
 */
router.post('/auto-answer-appointment', (req, res) => {
  const twilio = require('twilio');
  const response = new twilio.twiml.VoiceResponse();
  
  // Get appointment details from query params if provided
  const { patient_name, appointment_date, appointment_type } = req.query;
  
  let message = 'Hello! This is a test appointment confirmation call. ';
  
  if (patient_name) {
    message += `This call is for ${patient_name}. `;
  }
  
  if (appointment_date) {
    const date = new Date(appointment_date);
    message += `Your appointment is scheduled for ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}. `;
  }
  
  if (appointment_type) {
    message += `Appointment type: ${appointment_type}. `;
  }
  
  message += 'This is an automated test call. The appointment booking system is working correctly. Thank you!';
  
  response.say({
    voice: 'alice',
    language: 'en-US'
  }, message);
  
  response.hangup();
  
  res.type('text/xml');
  res.send(response.toString());
});

/**
 * Auto-answer that collects speech input (for testing STT)
 */
router.post('/auto-answer-collect', (req, res) => {
  const twilio = require('twilio');
  const response = new twilio.twiml.VoiceResponse();
  
  // Greet and ask for input
  response.say({
    voice: 'alice',
    language: 'en-US'
  }, 'Hello! This is a test call. Please say something, and I will repeat it back to you.');
  
  // Collect speech input
  const gather = response.gather({
    input: 'speech',
    timeout: 5,
    speechTimeout: 'auto',
    action: '/api/test-telephony/auto-answer-repeat',
    method: 'POST'
  });
  
  // If no input, say goodbye
  response.say('I did not receive any input. Goodbye!');
  response.hangup();
  
  res.type('text/xml');
  res.send(response.toString());
});

/**
 * Repeat back what was said (for testing STT)
 */
router.post('/auto-answer-repeat', (req, res) => {
  const twilio = require('twilio');
  const response = new twilio.twiml.VoiceResponse();
  
  const speechResult = req.body.SpeechResult || 'No speech detected';
  
  response.say({
    voice: 'alice',
    language: 'en-US'
  }, `You said: ${speechResult}. This is a test of the speech recognition system. Goodbye!`);
  
  response.hangup();
  
  res.type('text/xml');
  res.send(response.toString());
});

module.exports = router;
