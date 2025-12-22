export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-xl p-8 text-white">
          <h1 className="text-4xl font-bold mb-6 text-blue-400">Privacy Policy</h1>
          <p className="text-slate-300 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          
          <div className="space-y-6 text-slate-200">
            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">1. Introduction</h2>
              <p>
                EHealth Med AI ("we", "our", or "us") is committed to protecting your privacy. 
                This Privacy Policy explains how we collect, use, disclose, and safeguard your 
                information when you use our healthcare communication platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">2. Information We Collect</h2>
              <p>
                We collect information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Personal identification information (name, email, phone number)</li>
                <li>Healthcare-related information shared during communications</li>
                <li>Call recordings and transcripts</li>
                <li>Calendar and appointment information</li>
                <li>Medical record data (when integrated with EHR systems)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Provide and improve our healthcare communication services</li>
                <li>Process appointments and manage schedules</li>
                <li>Integrate with medical record systems (HL7/FHIR)</li>
                <li>Send automated communications and reminders</li>
                <li>Comply with legal and regulatory requirements (HIPAA)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">4. HIPAA Compliance</h2>
              <p>
                We are committed to maintaining the privacy and security of Protected Health Information (PHI) 
                in accordance with the Health Insurance Portability and Accountability Act (HIPAA). 
                We implement appropriate administrative, physical, and technical safeguards to protect your health information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">5. Data Security</h2>
              <p>
                We use industry-standard security measures to protect your information, including encryption, 
                access controls, and regular security audits. However, no method of transmission over the 
                internet is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">6. Third-Party Services</h2>
              <p>
                We may use third-party services (such as Twilio for telephony, Google Calendar for scheduling, 
                and SendGrid for email) that have their own privacy policies. We encourage you to review 
                their privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Access your personal information</li>
                <li>Request corrections to your information</li>
                <li>Request deletion of your information</li>
                <li>Opt-out of certain communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">8. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, please contact us at: 
                <a href="mailto:support@ehealthmedai.com" className="text-blue-400 hover:underline ml-1">
                  support@ehealthmedai.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

