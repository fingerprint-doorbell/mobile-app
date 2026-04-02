import { SensorConfig, Fingerprint, SensorStatus, EnrollResponse, FingerprintTemplate, ImportResponse, PinCode, PinCodeStatus } from '../types';

function buildHeaders(sensor: SensorConfig): Record<string, string> {
  const headers: Record<string, string> = {};
  if (sensor.apiKey) {
    headers['Authorization'] = `Bearer ${sensor.apiKey}`;
  }
  return headers;
}

function baseUrl(sensor: SensorConfig): string {
  const ip = sensor.ipAddress.replace(/\/+$/, '');
  const protocol = ip.startsWith('http') ? '' : 'http://';
  return `${protocol}${ip}/fingerprint`;
}

function pinCodeBaseUrl(sensor: SensorConfig): string {
  const ip = sensor.ipAddress.replace(/\/+$/, '');
  const protocol = ip.startsWith('http') ? '' : 'http://';
  return `${protocol}${ip}/pincode`;
}

export async function listFingerprints(sensor: SensorConfig): Promise<Fingerprint[]> {
  const response = await fetch(`${baseUrl(sensor)}/list`, {
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to list fingerprints: ${response.status}`);
  }
  return response.json();
}

export async function getStatus(sensor: SensorConfig): Promise<SensorStatus> {
  const response = await fetch(`${baseUrl(sensor)}/status`, {
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.status}`);
  }
  return response.json();
}

export async function enrollFingerprint(
  sensor: SensorConfig,
  id: number,
  name: string,
): Promise<EnrollResponse> {
  const response = await fetch(
    `${baseUrl(sensor)}/enroll?id=${id}&name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: buildHeaders(sensor),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to start enrollment: ${response.status}`);
  }
  return response.json();
}

export async function cancelEnrollment(sensor: SensorConfig): Promise<void> {
  const response = await fetch(`${baseUrl(sensor)}/cancel`, {
    method: 'POST',
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to cancel enrollment: ${response.status}`);
  }
}

export async function deleteFingerprint(sensor: SensorConfig, id: number): Promise<void> {
  const response = await fetch(`${baseUrl(sensor)}/delete?id=${id}`, {
    method: 'POST',
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete fingerprint: ${response.status}`);
  }
}

export async function deleteAllFingerprints(sensor: SensorConfig): Promise<void> {
  const response = await fetch(`${baseUrl(sensor)}/delete_all`, {
    method: 'POST',
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete all fingerprints: ${response.status}`);
  }
}

export async function renameFingerprint(
  sensor: SensorConfig,
  id: number,
  name: string,
): Promise<void> {
  const response = await fetch(
    `${baseUrl(sensor)}/rename?id=${id}&name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: buildHeaders(sensor),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to rename fingerprint: ${response.status}`);
  }
}

export async function pairSensor(
  sensor: SensorConfig,
  password: string,
): Promise<void> {
  const response = await fetch(
    `${baseUrl(sensor)}/pair?password=${encodeURIComponent(password)}`,
    {
      method: 'POST',
      headers: buildHeaders(sensor),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to pair sensor: ${response.status}`);
  }
}

export async function unpairSensor(sensor: SensorConfig): Promise<void> {
  const response = await fetch(`${baseUrl(sensor)}/unpair`, {
    method: 'POST',
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to unpair sensor: ${response.status}`);
  }
}

export async function factoryResetSensor(sensor: SensorConfig, oldPassword?: string): Promise<void> {
  let url = `${baseUrl(sensor)}/factory_reset`;
  if (oldPassword) {
    url += `?password=${encodeURIComponent(oldPassword)}`;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Factory reset failed: ${response.status}`);
  }
}

export async function exportTemplate(
  sensor: SensorConfig,
  id: number,
): Promise<FingerprintTemplate> {
  const response = await fetch(`${baseUrl(sensor)}/template?id=${id}`, {
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to export template: ${response.status}`);
  }
  return response.json();
}

export async function importTemplate(
  sensor: SensorConfig,
  template: FingerprintTemplate,
): Promise<ImportResponse> {
  // Send template in chunks to avoid URL/request size limits
  const CHUNK_SIZE = 128;
  const templateData = template.template;
  const totalChunks = Math.ceil(templateData.length / CHUNK_SIZE);
  const headers = buildHeaders(sensor);
  
  for (let i = 0; i < totalChunks; i++) {
    const chunk = templateData.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const isLast = (i === totalChunks - 1);
    
    const params = new URLSearchParams({
      id: template.id.toString(),
      chunk: i.toString(),
      total: totalChunks.toString(),
      data: chunk,
    });
    
    if (i === 0) {
      params.set('name', template.name);
    }
    
    const url = `${baseUrl(sensor)}/template/chunk?${params.toString()}`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
    });
    
    if (!response.ok) {
      throw new Error(`Failed to import template chunk ${i + 1}: ${response.status}`);
    }
    
    if (isLast) {
      return response.json();
    }
  }
  
  throw new Error('No chunks to send');
}

// ==================== PIN CODE API ====================

export async function listPinCodes(sensor: SensorConfig): Promise<PinCode[]> {
  const response = await fetch(`${pinCodeBaseUrl(sensor)}/list`, {
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to list PIN codes: ${response.status}`);
  }
  return response.json();
}

export async function getPinCodeStatus(sensor: SensorConfig): Promise<PinCodeStatus> {
  const response = await fetch(`${pinCodeBaseUrl(sensor)}/status`, {
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to get PIN code status: ${response.status}`);
  }
  return response.json();
}

export async function addPinCode(
  sensor: SensorConfig,
  id: number,
  code: string,
  name: string,
): Promise<void> {
  const response = await fetch(
    `${pinCodeBaseUrl(sensor)}/add?id=${id}&code=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: buildHeaders(sensor),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to add PIN code: ${response.status}`);
  }
}

export async function deletePinCode(sensor: SensorConfig, id: number): Promise<void> {
  const response = await fetch(`${pinCodeBaseUrl(sensor)}/delete?id=${id}`, {
    method: 'POST',
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete PIN code: ${response.status}`);
  }
}

export async function deleteAllPinCodes(sensor: SensorConfig): Promise<void> {
  const response = await fetch(`${pinCodeBaseUrl(sensor)}/delete_all`, {
    method: 'POST',
    headers: buildHeaders(sensor),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete all PIN codes: ${response.status}`);
  }
}

export async function renamePinCode(
  sensor: SensorConfig,
  id: number,
  name: string,
): Promise<void> {
  const response = await fetch(
    `${pinCodeBaseUrl(sensor)}/rename?id=${id}&name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: buildHeaders(sensor),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to rename PIN code: ${response.status}`);
  }
}

export async function updatePinCode(
  sensor: SensorConfig,
  id: number,
  code: string,
): Promise<void> {
  const response = await fetch(
    `${pinCodeBaseUrl(sensor)}/update?id=${id}&code=${encodeURIComponent(code)}`,
    {
      method: 'POST',
      headers: buildHeaders(sensor),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to update PIN code: ${response.status}`);
  }
}
