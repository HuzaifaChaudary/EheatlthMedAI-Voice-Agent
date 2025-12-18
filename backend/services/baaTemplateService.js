const db = require('../config/database');

class BAATemplateService {
  generateTemplate(organizationName, vendorName, vendorType) {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const template = `
BUSINESS ASSOCIATE AGREEMENT

This Business Associate Agreement ("Agreement") is entered into on ${currentDate} ("Effective Date") between:

${organizationName || '[Healthcare Organization Name]'} ("Covered Entity")

and

${vendorName} ("Business Associate")

WHEREAS, Covered Entity is subject to the Health Insurance Portability and Accountability Act of 1996, as amended by the Health Information Technology for Economic and Clinical Health Act (collectively, "HIPAA");

WHEREAS, Business Associate provides ${vendorType || 'services'} to Covered Entity that may involve the use or disclosure of Protected Health Information ("PHI");

WHEREAS, Covered Entity and Business Associate wish to enter into this Agreement to ensure that Business Associate will appropriately safeguard PHI;

NOW, THEREFORE, in consideration of the mutual promises and covenants contained herein, the parties agree as follows:

1. DEFINITIONS

Terms used but not otherwise defined in this Agreement shall have the same meaning as those terms in 45 CFR § 160.103 and 45 CFR § 164.501.

2. PERMITTED USES AND DISCLOSURES

Business Associate may use or disclose PHI to perform functions, activities, or services for, or on behalf of, Covered Entity as specified in the underlying service agreement, provided that such use or disclosure would not violate HIPAA if done by Covered Entity.

3. SAFEGUARDS

Business Associate agrees to:
a. Implement administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of PHI;
b. Ensure that any agents or subcontractors to whom it provides PHI agree to the same restrictions and conditions that apply to Business Associate;
c. Report to Covered Entity any security incident or breach of unsecured PHI in accordance with 45 CFR § 164.410.

4. MINIMUM NECESSARY

Business Associate shall make reasonable efforts to limit the use, disclosure, and requests for PHI to the minimum necessary to accomplish the intended purpose.

5. ACCESS TO PHI

Upon request, Business Associate shall provide access to PHI in a Designated Record Set to Covered Entity or, as directed by Covered Entity, to an Individual, in order to meet the requirements under 45 CFR § 164.524.

6. AMENDMENT OF PHI

Business Associate shall make any amendment(s) to PHI in a Designated Record Set as directed or agreed to by Covered Entity pursuant to 45 CFR § 164.526.

7. ACCOUNTING OF DISCLOSURES

Business Associate shall document such disclosures of PHI and information related to such disclosures as would be required for Covered Entity to respond to a request by an Individual for an accounting of disclosures of PHI in accordance with 45 CFR § 164.528.

8. TERM AND TERMINATION

a. Term: The Term of this Agreement shall be effective as of the Effective Date and shall terminate when all PHI provided by Covered Entity to Business Associate is destroyed or returned to Covered Entity.
b. Termination: Either party may terminate this Agreement upon thirty (30) days written notice if the other party materially breaches this Agreement and fails to cure such breach within such notice period.

9. RETURN OR DESTRUCTION OF PHI

Upon termination of this Agreement, Business Associate shall return or destroy all PHI received from Covered Entity, or created or received by Business Associate on behalf of Covered Entity, that Business Associate still maintains in any form. If return or destruction is not feasible, Business Associate shall extend the protections of this Agreement to such information and limit further uses and disclosures.

10. MISCELLANEOUS

This Agreement constitutes the entire agreement between the parties concerning the subject matter hereof and supersedes all prior agreements. This Agreement may not be amended except in writing signed by both parties.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.

${organizationName || '[Healthcare Organization Name]'}
_________________________
Authorized Signature

Date: ___________

${vendorName}
_________________________
Authorized Signature

Date: ___________
`;

    return template.trim();
  }

  async generateAndSave(organizationId, vendorName, vendorType, userId) {
    try {
      const orgResult = await db.query(
        'SELECT name FROM organizations WHERE id = $1',
        [organizationId]
      );

      const organizationName = orgResult.rows[0]?.name || 'Healthcare Organization';

      const template = this.generateTemplate(organizationName, vendorName, vendorType);

      const agreementNumber = `BAA-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const documentUrl = `/api/hipaa/baa/document/${agreementNumber}`;

      const result = await db.query(
        `INSERT INTO baa_agreements (
          organization_id, vendor_name, vendor_type, status, 
          signed_date, expiration_date, document_url, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          organizationId,
          vendorName,
          vendorType,
          'pending',
          null,
          null,
          documentUrl,
          `Template generated on ${new Date().toISOString()}`
        ]
      );

      const agreementId = result.rows[0].id;

      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'GENERATE_BAA_TEMPLATE',
          'baa_agreements',
          agreementId,
          JSON.stringify({ vendor_name: vendorName, vendor_type: vendorType })
        ]
      );

      return {
        agreement: result.rows[0],
        template: template,
        document_url: documentUrl
      };
    } catch (error) {
      console.error('Error generating BAA template:', error);
      throw error;
    }
  }
}

module.exports = new BAATemplateService();

