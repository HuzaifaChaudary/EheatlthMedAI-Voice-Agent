Smart Device Integration Guide for EHealth Med AI

Overview

EHealth Med AI can be integrated with smart voice assistants including Amazon Alexa, Google Assistant, and Apple Siri to enable voice interactions through smart speakers and devices. This guide provides instructions for setting up these integrations.

Supported Platforms

Amazon Alexa Skills
Google Assistant Actions
Apple Siri Shortcuts (Coming Soon)
Microsoft Cortana Skills (Coming Soon)

Prerequisites

Active EHealth Med AI account with API access
Developer accounts for target platforms:
Amazon Developer Account (for Alexa)
Google Cloud Platform account (for Google Assistant)
Organization API key from EHealth Med AI dashboard
HTTPS endpoint for webhook callbacks (required)

Amazon Alexa Integration

Setup

1. Create Alexa Skill

Log into Amazon Developer Console
Create a new Alexa Skill
Choose Custom model type
Select language (English US recommended)
Name your skill (e.g., "EHealth Assistant")

2. Configure Skill Information

Invocation Name: "ehealth assistant" or "my health assistant"
Endpoint: HTTPS endpoint pointing to your EHealth Med AI webhook handler
Account Linking: Enable OAuth 2.0 with your EHealth Med AI authorization server

3. Intent Schema

Create custom intents for common interactions:

{
  "intents": [
    {
      "name": "ScheduleAppointment",
      "slots": [
        {
          "name": "Date",
          "type": "AMAZON.DATE"
        },
        {
          "name": "Time",
          "type": "AMAZON.TIME"
        }
      ]
    },
    {
      "name": "CheckAppointment",
      "slots": []
    },
    {
      "name": "CancelAppointment",
      "slots": [
        {
          "name": "AppointmentId",
          "type": "AMAZON.NUMBER"
        }
      ]
    },
    {
      "name": "GeneralQuestion",
      "slots": [
        {
          "name": "Question",
          "type": "AMAZON.SearchQuery"
        }
      ]
    },
    {
      "name": "AMAZON.CancelIntent",
      "slots": []
    },
    {
      "name": "AMAZON.HelpIntent",
      "slots": []
    },
    {
      "name": "AMAZON.StopIntent",
      "slots": []
    }
  ]
}

4. Webhook Handler

Create an endpoint that handles Alexa requests:

POST /api/integrations/alexa/webhook

Example handler (Node.js/Express):

app.post('/api/integrations/alexa/webhook', async (req, res) => {
  const { request, session } = req.body;
  
  // Verify request signature (recommended for production)
  // VerifyAlexaSignature(req);
  
  const intentName = request.intent?.name;
  const agentId = await getAgentIdFromSession(session);
  
  let responseText = '';
  
  try {
    switch (intentName) {
      case 'ScheduleAppointment':
        const date = request.intent.slots?.Date?.value;
        const time = request.intent.slots?.Time?.value;
        // Call EHealth Med AI API
        const result = await ehealthMedAI.sendMessage({
          conversationId: session.attributes?.conversationId,
          agentId: agentId,
          message: `Schedule appointment for ${date} at ${time}`
        });
        responseText = result.response;
        break;
        
      case 'GeneralQuestion':
        const question = request.intent.slots?.Question?.value;
        const aiResponse = await ehealthMedAI.sendMessage({
          conversationId: session.attributes?.conversationId,
          agentId: agentId,
          message: question
        });
        responseText = aiResponse.response;
        break;
        
      default:
        responseText = "I'm sorry, I didn't understand that. How can I help you?";
    }
  } catch (error) {
    responseText = "I apologize, but I encountered an error. Please try again.";
  }
  
  const response = {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text: responseText
      },
      shouldEndSession: false
    },
    sessionAttributes: {
      conversationId: session.attributes?.conversationId
    }
  };
  
  res.json(response);
});

5. Account Linking

Configure OAuth 2.0 in Alexa Developer Console:

Authorization URL: https://api.ehealthmedai.com/oauth/authorize
Access Token URL: https://api.ehealthmedai.com/oauth/token
Client ID: Your EHealth Med AI client ID
Client Secret: Your EHealth Med AI client secret
Scope: read:conversations write:conversations

Google Assistant Integration

Setup

1. Create Google Action

Go to Google Actions Console
Create new project
Choose Conversational category
Configure Action display name and invocation phrase

2. Configure Fulfillment

Set webhook URL: https://your-domain.com/api/integrations/google/webhook
Enable webhook for default intent

3. Create Dialogflow Agent (Recommended)

Create Dialogflow agent
Import EHealth Med AI pre-built intents (if available)
Configure fulfillment to use webhook
Set up entity types for dates, times, appointment types

4. Webhook Handler

POST /api/integrations/google/webhook

Example handler:

app.post('/api/integrations/google/webhook', async (req, res) => {
  const { queryResult, session } = req.body;
  
  const intentName = queryResult.intent?.displayName;
  const parameters = queryResult.parameters || {};
  const agentId = await getAgentIdFromUser(session);
  
  try {
    // Build message from intent and parameters
    let message = '';
    if (intentName === 'ScheduleAppointment') {
      message = `Schedule appointment for ${parameters.date} at ${parameters.time}`;
    } else {
      message = queryResult.queryText;
    }
    
    // Call EHealth Med AI API
    const aiResponse = await ehealthMedAI.sendMessage({
      conversationId: session.attributes?.conversationId,
      agentId: agentId,
      message: message
    });
    
    const response = {
      fulfillmentText: aiResponse.response,
      fulfillmentMessages: [
        {
          text: {
            text: [aiResponse.response]
          }
        }
      ],
      sessionInfo: {
        session: session,
        parameters: {
          conversationId: session.attributes?.conversationId
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    res.json({
      fulfillmentText: "I apologize, but I encountered an error. Please try again."
    });
  }
});

Security and HIPAA Compliance

All integrations must follow HIPAA compliance requirements:

1. Authentication

Require OAuth 2.0 authentication for all users
Verify user identity before accessing health information
Use secure token storage

2. Data Encryption

All communications must use TLS 1.2 or higher
Encrypt sensitive data in transit
Never log PHI (Protected Health Information) in plain text

3. Consent Management

Obtain explicit consent before:
Recording conversations
Accessing patient data
Sharing information with third parties

4. Audit Logging

Log all interactions:
User authentication events
API calls and responses
Data access events
Error events

5. Access Control

Implement role-based access control
Verify user permissions before data access
Use session management for secure conversations

Configuration

Environment Variables

ALEXA_SKILL_ID=amzn1.ask.skill.xxxxx
GOOGLE_ACTION_PROJECT_ID=your-project-id
EHEALTH_API_KEY=your-api-key
EHEALTH_API_URL=https://api.ehealthmedai.com
WEBHOOK_SECRET=your-webhook-secret

Verification

For production deployments, verify request signatures:

Amazon Alexa: Verify request signature using certificate chain
Google Assistant: Verify request using service account credentials

Testing

Local Testing

Use ngrok or similar tool to expose local webhook endpoint
Configure skill/action to use ngrok URL
Test interactions through device or simulator

Production Testing

Deploy webhook handler to production
Update skill/action endpoint URL
Submit for certification review

Best Practices

1. Error Handling

Always provide user-friendly error messages
Log errors for debugging without exposing PHI
Implement retry logic for transient failures

2. Session Management

Maintain conversation context across requests
Store conversation IDs in session attributes
Handle session timeouts gracefully

3. User Experience

Keep responses concise and clear
Provide helpful prompts for next actions
Handle interruptions gracefully (user says "stop" or "cancel")

4. Performance

Optimize response times (aim for < 2 seconds)
Cache frequently accessed data
Use async processing for long-running operations

Limitations

Smart devices have limitations for healthcare use:

No visual interface for complex information
Limited ability to handle multi-step processes
Voice-only interaction may not be suitable for all scenarios
Network connectivity required
Potential privacy concerns with always-listening devices

Recommendations

Use smart device integration for:
Appointment scheduling
Simple health questions
Medication reminders
Appointment reminders
General inquiries

Avoid using for:
Sensitive health information disclosure
Complex medical advice
Emergency situations
Detailed medical history discussions

Support and Documentation

For integration support:
Email: integrations@ehealthmedai.com
Documentation: https://docs.ehealthmedai.com/integrations
API Reference: https://docs.ehealthmedai.com/api

