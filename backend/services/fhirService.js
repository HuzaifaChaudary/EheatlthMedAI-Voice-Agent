/**
 * FHIR Service - Handles FHIR resource creation and retrieval
 * Supports FHIR R4 specification
 */

class FHIRService {
  constructor() {
    this.defaultVersion = 'R4';
  }

  /**
   * Get authentication headers for FHIR requests
   */
  getAuthHeaders(connector) {
    const { authentication_type, credentials } = connector;
    const headers = {
      'Content-Type': 'application/fhir+json',
      'Accept': 'application/fhir+json'
    };

    if (authentication_type === 'basic' && credentials) {
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    } else if (authentication_type === 'bearer' && credentials?.token) {
      headers['Authorization'] = `Bearer ${credentials.token}`;
    } else if (authentication_type === 'oauth2' && credentials?.access_token) {
      headers['Authorization'] = `Bearer ${credentials.access_token}`;
    }

    return headers;
  }

  /**
   * Create FHIR Patient resource
   */
  createPatientResource(patientData) {
    const { patientId, name, dob, gender, phone, email, address } = patientData;

    const patient = {
      resourceType: 'Patient',
      id: patientId || undefined,
      identifier: patientId ? [{
        use: 'usual',
        value: patientId
      }] : [],
      name: name ? [{
        use: 'official',
        family: name.last || '',
        given: name.first ? [name.first] : [],
        prefix: name.prefix ? [name.prefix] : [],
        suffix: name.suffix ? [name.suffix] : []
      }] : [],
      telecom: [],
      gender: gender || 'unknown',
      birthDate: dob || undefined,
      address: address ? [{
        use: 'home',
        line: address.line || [],
        city: address.city || '',
        state: address.state || '',
        postalCode: address.postalCode || '',
        country: address.country || 'US'
      }] : []
    };

    if (phone) {
      patient.telecom.push({
        system: 'phone',
        value: phone,
        use: 'mobile'
      });
    }

    if (email) {
      patient.telecom.push({
        system: 'email',
        value: email,
        use: 'home'
      });
    }

    return patient;
  }

  /**
   * Create FHIR Appointment resource
   */
  createAppointmentResource(appointmentData) {
    const { appointmentId, patientId, practitionerId, startTime, endTime, 
            status, appointmentType, description, location } = appointmentData;

    const appointment = {
      resourceType: 'Appointment',
      id: appointmentId || undefined,
      status: status || 'booked',
      serviceType: appointmentType ? [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/service-type',
          code: appointmentType.toLowerCase().replace(/\s+/g, '-'),
          display: appointmentType
        }]
      }] : [],
      description: description || '',
      start: startTime || new Date().toISOString(),
      end: endTime || undefined,
      participant: [
        {
          actor: {
            reference: `Patient/${patientId}`,
            display: appointmentData.patientName || 'Patient'
          },
          required: 'required',
          status: 'accepted'
        }
      ],
      created: new Date().toISOString()
    };

    if (practitionerId) {
      appointment.participant.push({
        actor: {
          reference: `Practitioner/${practitionerId}`,
          display: appointmentData.practitionerName || 'Practitioner'
        },
        required: 'required',
        status: 'accepted'
      });
    }

    if (location) {
      appointment.participant.push({
        actor: {
          reference: `Location/${location.id}`,
          display: location.name || 'Location'
        },
        required: 'optional',
        status: 'accepted'
      });
    }

    return appointment;
  }

  /**
   * Create FHIR Encounter resource
   */
  createEncounterResource(encounterData) {
    const { encounterId, patientId, status, type, startTime, endTime, 
            location, appointmentId } = encounterData;

    const encounter = {
      resourceType: 'Encounter',
      id: encounterId || undefined,
      status: status || 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      type: type ? [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: type.code || '',
          display: type.display || type
        }]
      }] : [],
      subject: {
        reference: `Patient/${patientId}`,
        display: encounterData.patientName || 'Patient'
      },
      period: {
        start: startTime || new Date().toISOString(),
        end: endTime || undefined
      },
      location: location ? [{
        location: {
          reference: `Location/${location.id}`,
          display: location.name || 'Location'
        }
      }] : []
    };

    if (appointmentId) {
      encounter.appointment = [{
        reference: `Appointment/${appointmentId}`
      }];
    }

    return encounter;
  }

  /**
   * POST resource to FHIR server
   */
  async createResource(connector, resourceType, resource) {
    try {
      const { base_url, fhir_version } = connector;
      const url = `${base_url}/${resourceType}`;
      const headers = this.getAuthHeaders(connector);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(resource)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FHIR server returned status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return {
        success: true,
        resource: result,
        id: result.id,
        statusCode: response.status
      };
    } catch (error) {
      console.error(`Error creating FHIR ${resourceType}:`, error);
      throw new Error(`Failed to create FHIR ${resourceType}: ${error.message}`);
    }
  }

  /**
   * GET resource from FHIR server
   */
  async getResource(connector, resourceType, resourceId) {
    try {
      const { base_url } = connector;
      const url = `${base_url}/${resourceType}/${resourceId}`;
      const headers = this.getAuthHeaders(connector);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (response.status === 404) {
        return { success: false, error: 'Resource not found' };
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FHIR server returned status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return {
        success: true,
        resource: result
      };
    } catch (error) {
      console.error(`Error getting FHIR ${resourceType}:`, error);
      throw new Error(`Failed to get FHIR ${resourceType}: ${error.message}`);
    }
  }

  /**
   * SEARCH resources from FHIR server
   */
  async searchResources(connector, resourceType, searchParams = {}) {
    try {
      const { base_url } = connector;
      const queryParams = new URLSearchParams();
      
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          queryParams.append(key, value);
        }
      });

      const url = `${base_url}/${resourceType}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const headers = this.getAuthHeaders(connector);

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FHIR server returned status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return {
        success: true,
        resources: result.entry ? result.entry.map(entry => entry.resource) : [],
        total: result.total || 0,
        bundle: result
      };
    } catch (error) {
      console.error(`Error searching FHIR ${resourceType}:`, error);
      throw new Error(`Failed to search FHIR ${resourceType}: ${error.message}`);
    }
  }

  /**
   * UPDATE resource on FHIR server
   */
  async updateResource(connector, resourceType, resourceId, resource) {
    try {
      const { base_url } = connector;
      const url = `${base_url}/${resourceType}/${resourceId}`;
      const headers = this.getAuthHeaders(connector);

      // Ensure resource has correct ID and version
      resource.id = resourceId;

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(resource)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FHIR server returned status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return {
        success: true,
        resource: result,
        statusCode: response.status
      };
    } catch (error) {
      console.error(`Error updating FHIR ${resourceType}:`, error);
      throw new Error(`Failed to update FHIR ${resourceType}: ${error.message}`);
    }
  }

  /**
   * DELETE resource from FHIR server
   */
  async deleteResource(connector, resourceType, resourceId) {
    try {
      const { base_url } = connector;
      const url = `${base_url}/${resourceType}/${resourceId}`;
      const headers = this.getAuthHeaders(connector);

      const response = await fetch(url, {
        method: 'DELETE',
        headers
      });

      if (response.status === 404) {
        return { success: false, error: 'Resource not found' };
      }

      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        throw new Error(`FHIR server returned status ${response.status}: ${errorText}`);
      }

      return {
        success: true,
        statusCode: response.status || 204
      };
    } catch (error) {
      console.error(`Error deleting FHIR ${resourceType}:`, error);
      throw new Error(`Failed to delete FHIR ${resourceType}: ${error.message}`);
    }
  }
}

module.exports = new FHIRService();

