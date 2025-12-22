export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg shadow-xl p-8 text-white">
          <h1 className="text-4xl font-bold mb-6 text-blue-400">Terms of Service</h1>
          <p className="text-slate-300 mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          
          <div className="space-y-6 text-slate-200">
            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">1. Acceptance of Terms</h2>
              <p>
                By accessing and using EHealth Med AI ("the Service"), you accept and agree to be bound by 
                the terms and provision of this agreement. If you do not agree to these Terms of Service, 
                please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">2. Description of Service</h2>
              <p>
                EHealth Med AI is a healthcare communication platform that provides:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>AI-powered voice agents for healthcare communications</li>
                <li>Telephony services with call recording</li>
                <li>Calendar and appointment management</li>
                <li>Integration with medical record systems (HL7/FHIR)</li>
                <li>Automated email communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">3. User Accounts</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for 
                all activities that occur under your account. You agree to notify us immediately of any 
                unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">4. Healthcare Compliance</h2>
              <p>
                Users are responsible for ensuring that their use of the Service complies with all applicable 
                healthcare regulations, including but not limited to HIPAA, state privacy laws, and professional 
                standards. We provide tools to assist with compliance, but ultimate responsibility lies with the user.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Violate any laws in your jurisdiction</li>
                <li>Transmit any malicious code or viruses</li>
                <li>Attempt to gain unauthorized access to the Service</li>
                <li>Interfere with or disrupt the Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">6. Intellectual Property</h2>
              <p>
                The Service and its original content, features, and functionality are owned by EHealth Med AI 
                and are protected by international copyright, trademark, patent, trade secret, and other 
                intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">7. Limitation of Liability</h2>
              <p>
                EHealth Med AI shall not be liable for any indirect, incidental, special, consequential, or 
                punitive damages resulting from your use of or inability to use the Service. The Service is 
                provided "as is" without warranties of any kind.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">8. Termination</h2>
              <p>
                We may terminate or suspend your account and access to the Service immediately, without prior 
                notice, for conduct that we believe violates these Terms of Service or is harmful to other users, 
                us, or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">9. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms of Service at any time. We will notify users of any 
                material changes by posting the new Terms of Service on this page.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-blue-300">10. Contact Information</h2>
              <p>
                If you have any questions about these Terms of Service, please contact us at: 
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

