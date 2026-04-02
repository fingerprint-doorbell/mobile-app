import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  SectionList,
  SectionListData,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SensorConfig } from '../types';
import { loadSensors, deleteSensor, addSensor } from '../services/storage';
import { DiscoveredDevice } from '../services/electron';
import { getDiscoveryService, isDiscoverySupported } from '../services/discovery';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'SensorList'>;

// Hook to handle Escape key for closing modals (web/electron only)
function useEscapeKey(isVisible: boolean, onClose: () => void) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);
}

export default function SensorListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [sensors, setSensors] = useState<SensorConfig[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SensorConfig | null>(null);
  
  const [addDiscoveredModalVisible, setAddDiscoveredModalVisible] = useState(false);
  const [selectedDiscovered, setSelectedDiscovered] = useState<DiscoveredDevice | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // Escape key handlers for modals
  useEscapeKey(deleteModalVisible, () => setDeleteModalVisible(false));
  useEscapeKey(addDiscoveredModalVisible, () => setAddDiscoveredModalVisible(false));

  useFocusEffect(
    useCallback(() => {
      loadSensors().then(setSensors);
    }, []),
  );

  // Set up mDNS discovery for all platforms
  useEffect(() => {
    if (!isDiscoverySupported()) return;

    const discovery = getDiscoveryService();

    // Get initial devices
    discovery.getDiscoveredDevices().then(setDiscoveredDevices);

    // Listen for new devices
    discovery.onDeviceFound((device) => {
      setDiscoveredDevices((prev) => {
        const exists = prev.some((d) => d.name === device.name);
        if (exists) {
          return prev.map((d) => (d.name === device.name ? device : d));
        }
        return [...prev, device];
      });
    });

    // Listen for lost devices
    discovery.onDeviceLost((device) => {
      setDiscoveredDevices((prev) => prev.filter((d) => d.name !== device.name));
    });

    // Start discovery
    discovery.startDiscovery();

    return () => {
      discovery.stopDiscovery();
      discovery.removeListeners();
    };
  }, []);

  // Filter out already-added devices from discovered list
  const newDiscoveredDevices = discoveredDevices.filter(
    (device) => !sensors.some((s) => s.ipAddress === device.ip || s.name === device.name)
  );

  const handleDelete = (sensor: SensorConfig) => {
    setDeleteTarget(sensor);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteSensor(deleteTarget.id);
    setSensors((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteModalVisible(false);
    setDeleteTarget(null);
  };

  const handleAddDiscovered = (device: DiscoveredDevice) => {
    setSelectedDiscovered(device);
    setApiKeyInput('');
    setAddDiscoveredModalVisible(true);
  };

  const confirmAddDiscovered = async () => {
    if (!selectedDiscovered) return;
    
    const newSensor: SensorConfig = {
      id: Date.now().toString(),
      name: selectedDiscovered.name,
      ipAddress: selectedDiscovered.ip,
      apiKey: apiKeyInput.trim(),
    };
    
    await addSensor(newSensor);
    setSensors((prev) => [...prev, newSensor]);
    setAddDiscoveredModalVisible(false);
    setSelectedDiscovered(null);
    setApiKeyInput('');
  };

  const renderSensorCard = (item: SensorConfig) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardIp}>{item.ipAddress}</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('SensorForm', { sensor: item })}
        >
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
        >
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('FingerprintList', { sensor: item })}
        >
          <Text style={styles.navIcon}>👆</Text>
          <Text style={styles.navText}>Fingerprints</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('PinCodeList', { sensor: item })}
        >
          <Text style={styles.navIcon}>🔢</Text>
          <Text style={styles.navText}>PIN Codes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDiscoveredCard = (item: DiscoveredDevice) => (
    <TouchableOpacity
      style={[styles.card, styles.discoveredCard]}
      onPress={() => handleAddDiscovered(item)}
    >
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardIp}>{item.ip}</Text>
        </View>
        <View style={styles.addBadge}>
          <Text style={styles.addBadgeText}>+ Add</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const hasContent = sensors.length > 0 || newDiscoveredDevices.length > 0;

  return (
    <View style={styles.container}>
      {!hasContent ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>No Doorbells</Text>
          <Text style={styles.emptyText}>
            {isDiscoverySupported() 
              ? 'Searching for ESPHome devices...\nOr add a doorbell manually.'
              : 'Add a fingerprint doorbell to get started.'}
          </Text>
        </View>
      ) : (
        <SectionList<DiscoveredDevice | SensorConfig, { title: string; type: 'discovered' | 'sensor' }>
          sections={[
            ...(newDiscoveredDevices.length > 0
              ? [{ title: 'Discovered', data: newDiscoveredDevices as (DiscoveredDevice | SensorConfig)[], type: 'discovered' as const }]
              : []),
            ...(sensors.length > 0
              ? [{ title: 'My Doorbells', data: sensors as (DiscoveredDevice | SensorConfig)[], type: 'sensor' as const }]
              : []),
          ]}
          keyExtractor={(item, index) => ('id' in item ? item.id : (item as DiscoveredDevice).name) + index}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, section }) =>
            section.type === 'discovered'
              ? renderDiscoveredCard(item as DiscoveredDevice)
              : renderSensorCard(item as SensorConfig)
          }
        />
      )}
      
      <TouchableOpacity
        style={[styles.fab, { bottom: 32 + insets.bottom }]}
        onPress={() => navigation.navigate('SensorForm', {})}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Delete Doorbell</Text>
            <Text style={styles.modalLabel}>
              Are you sure you want to remove "{deleteTarget?.name}"?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, styles.modalDelete]}
                onPress={confirmDelete}
              >
                <Text style={styles.modalSaveText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Discovered Device Modal */}
      <Modal visible={addDiscoveredModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Doorbell</Text>
            <Text style={styles.modalLabel}>
              Found: {selectedDiscovered?.name}
            </Text>
            <Text style={styles.modalSubLabel}>
              IP: {selectedDiscovered?.ip}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder="API Key (optional)"
              autoCapitalize="none"
              secureTextEntry
              onSubmitEditing={confirmAddDiscovered}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setAddDiscoveredModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={confirmAddDiscovered}
              >
                <Text style={styles.modalSaveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  list: { padding: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  discoveredCard: {
    borderWidth: 2,
    borderColor: '#4a90d9',
    borderStyle: 'dashed',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '600', color: '#333' },
  cardIp: { fontSize: 13, color: '#888', marginTop: 4 },
  cardActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 10,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  navIcon: { fontSize: 18, marginRight: 8 },
  navText: { fontSize: 14, fontWeight: '500', color: '#333' },
  editButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e8e8e8',
  },
  editText: { fontSize: 14, color: '#555', fontWeight: '500' },
  deleteButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fde8e8',
    marginLeft: 8,
  },
  deleteText: { fontSize: 14, color: '#d9534f', fontWeight: '500' },
  addBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#4a90d9',
  },
  addBadgeText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4a90d9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: { fontSize: 28, color: '#fff', marginTop: -2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16 },
  modalLabel: { fontSize: 15, color: '#555', marginBottom: 8 },
  modalSubLabel: { fontSize: 13, color: '#888', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCancelText: { color: '#888', fontSize: 15 },
  modalSave: {
    backgroundColor: '#4a90d9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalDelete: { backgroundColor: '#d9534f' },
});
