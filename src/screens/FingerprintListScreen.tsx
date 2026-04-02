import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
  Platform,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Fingerprint, SensorConfig, FingerprintTemplate } from '../types';
import {
  listFingerprints,
  deleteFingerprint,
  renameFingerprint,
  enrollFingerprint,
  cancelEnrollment,
  getStatus,
  exportTemplate,
  importTemplate,
  pairSensor,
  unpairSensor,
} from '../services/api';
import { loadSensors } from '../services/storage';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'FingerprintList'>;

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

export default function FingerprintListScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { sensor } = route.params;
  const [fingerprints, setFingerprints] = useState<Fingerprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Fingerprint | null>(null);

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Fingerprint | null>(null);
  const [newName, setNewName] = useState('');

  const [enrollModalVisible, setEnrollModalVisible] = useState(false);
  const [enrollName, setEnrollName] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState('');

  const [copyModalVisible, setCopyModalVisible] = useState(false);
  const [copyTarget, setCopyTarget] = useState<Fingerprint | null>(null);
  const [otherSensors, setOtherSensors] = useState<SensorConfig[]>([]);
  const [copying, setCopying] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const [sensorPaired, setSensorPaired] = useState<boolean | null>(null);
  const [pairModalVisible, setPairModalVisible] = useState(false);
  const [pairPassword, setPairPassword] = useState('');
  const [pairing, setPairing] = useState(false);
  const [pairOptionsVisible, setPairOptionsVisible] = useState(false);
  const [unpairConfirmVisible, setUnpairConfirmVisible] = useState(false);

  // Escape key handlers for modals
  useEscapeKey(deleteModalVisible, () => setDeleteModalVisible(false));
  useEscapeKey(renameModalVisible, () => setRenameModalVisible(false));
  useEscapeKey(enrollModalVisible, () => {
    if (enrolling) {
      handleCancelEnroll();
    } else {
      setEnrollModalVisible(false);
    }
  });
  useEscapeKey(copyModalVisible, () => {
    if (!copying) {
      setCopyModalVisible(false);
    }
  });
  useEscapeKey(pairModalVisible, () => {
    if (!pairing) {
      setPairModalVisible(false);
    }
  });
  useEscapeKey(pairOptionsVisible, () => setPairOptionsVisible(false));
  useEscapeKey(unpairConfirmVisible, () => setUnpairConfirmVisible(false));

  React.useEffect(() => {
    navigation.setOptions({
      title: sensor.name,
      headerLeft: Platform.OS === 'web' ? () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      ) : undefined,
    });
  }, [sensor.name, navigation]);

  const fetchFingerprints = useCallback(async () => {
    try {
      setError(null);
      const status = await getStatus(sensor);
      setSensorPaired(status.paired);
      
      if (status.paired) {
        const data = await listFingerprints(sensor);
        setFingerprints(data);
      } else {
        setFingerprints([]);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to connect to sensor');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sensor]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchFingerprints();
    }, [fetchFingerprints]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFingerprints();
  };

  const handleDelete = (fp: Fingerprint) => {
    setDeleteTarget(fp);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFingerprint(sensor, deleteTarget.id);
      setFingerprints((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteModalVisible(false);
      setDeleteTarget(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const openRenameModal = (fp: Fingerprint) => {
    setRenameTarget(fp);
    setNewName(fp.name);
    setRenameModalVisible(true);
  };

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;
    try {
      await renameFingerprint(sensor, renameTarget.id, newName.trim());
      setFingerprints((prev) =>
        prev.map((f) =>
          f.id === renameTarget.id ? { ...f, name: newName.trim() } : f,
        ),
      );
      setRenameModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const getNextId = (): number => {
    if (fingerprints.length === 0) return 1;
    const usedIds = new Set(fingerprints.map((f) => f.id));
    let nextId = 1;
    while (usedIds.has(nextId)) {
      nextId++;
    }
    return nextId;
  };

  const openEnrollModal = () => {
    setEnrollName('');
    setEnrolling(false);
    setEnrollStatus('');
    setEnrollModalVisible(true);
  };

  const handleEnroll = async () => {
    if (!enrollName.trim()) {
      Alert.alert('Error', 'Please enter a name for the fingerprint.');
      return;
    }

    const nextId = getNextId();
    setEnrolling(true);
    setEnrollStatus('Starting enrollment...');

    try {
      await enrollFingerprint(sensor, nextId, enrollName.trim());
      setEnrollStatus(
        `Enrollment started for ID ${nextId}.\nPlace your finger on the sensor 5 times.\nThe LED will guide you.`,
      );

      const pollInterval = setInterval(async () => {
        try {
          const status = await getStatus(sensor);
          if (!status.enrolling) {
            clearInterval(pollInterval);
            setEnrolling(false);
            setEnrollModalVisible(false);
            fetchFingerprints();
          }
        } catch {
          clearInterval(pollInterval);
          setEnrolling(false);
          setEnrollStatus('Lost connection to sensor.');
        }
      }, 2000);
    } catch (e: any) {
      setEnrolling(false);
      setEnrollStatus('');
      Alert.alert('Error', e.message);
    }
  };

  const handleCancelEnroll = async () => {
    try {
      await cancelEnrollment(sensor);
    } catch {}
    setEnrolling(false);
    setEnrollModalVisible(false);
  };

  const openCopyModal = async (fp: Fingerprint) => {
    setCopyTarget(fp);
    setCopying(false);
    setCopyStatus('');
    
    try {
      const allSensors = await loadSensors();
      const others = allSensors.filter((s) => s.id !== sensor.id);
      setOtherSensors(others);
      setCopyModalVisible(true);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load sensors');
    }
  };

  const handleCopyTo = async (targetSensor: SensorConfig) => {
    if (!copyTarget) return;
    
    setCopying(true);
    setCopyStatus(`Exporting from ${sensor.name}...`);
    
    try {
      const template = await exportTemplate(sensor, copyTarget.id);
      
      setCopyStatus(`Importing to ${targetSensor.name}...`);
      
      const targetFingerprints = await listFingerprints(targetSensor);
      const usedIds = new Set(targetFingerprints.map((f) => f.id));
      let newId = copyTarget.id;
      if (usedIds.has(newId)) {
        newId = 1;
        while (usedIds.has(newId)) {
          newId++;
        }
      }
      
      const importData: FingerprintTemplate = {
        id: newId,
        name: template.name,
        template: template.template,
      };
      
      await importTemplate(targetSensor, importData);
      
      setCopying(false);
      setCopyModalVisible(false);
      Alert.alert(
        'Success',
        `Fingerprint "${template.name}" copied to ${targetSensor.name} as ID ${newId}.`
      );
    } catch (e: any) {
      setCopying(false);
      setCopyStatus('');
      Alert.alert('Error', e.message || 'Failed to copy fingerprint');
    }
  };

  const openPairModal = () => {
    setPairPassword('');
    setPairing(false);
    setPairModalVisible(true);
  };

  const handlePair = async () => {
    if (!pairPassword.trim()) {
      Alert.alert('Error', 'Please enter a password (8 hex digits, e.g. 12345678)');
      return;
    }
    
    // Validate hex format
    if (!/^[0-9a-fA-F]{1,8}$/.test(pairPassword.trim())) {
      Alert.alert('Error', 'Password must be 1-8 hex digits (0-9, A-F)');
      return;
    }
    
    setPairing(true);
    try {
      await pairSensor(sensor, pairPassword.trim());
      setPairModalVisible(false);
      setSensorPaired(true);
      fetchFingerprints();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to pair sensor');
    } finally {
      setPairing(false);
    }
  };

  const handlePairingOptions = () => {
    setPairOptionsVisible(true);
  };

  const handleChangePassword = () => {
    setPairOptionsVisible(false);
    setPairPassword('');
    setPairModalVisible(true);
  };

  const handleUnpairOption = () => {
    setPairOptionsVisible(false);
    setUnpairConfirmVisible(true);
  };

  const confirmUnpair = async () => {
    try {
      await unpairSensor(sensor);
      setSensorPaired(false);
      setUnpairConfirmVisible(false);
    } catch (e: any) {
      // Show error in the modal or use a simple alert fallback
      if (Platform.OS === 'web') {
        window.alert(e.message || 'Failed to unpair sensor');
      } else {
        Alert.alert('Error', e.message || 'Failed to unpair sensor');
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4a90d9" />
        <Text style={styles.loadingText}>Connecting to sensor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchFingerprints(); }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show pairing screen if sensor is not paired
  if (sensorPaired === false) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.pairIcon}>🔐</Text>
          <Text style={styles.pairTitle}>Sensor Not Paired</Text>
          <Text style={styles.pairText}>
            This sensor is not secured with a password. Pair it to prevent unauthorized sensor swaps.
          </Text>
          <TouchableOpacity style={styles.pairButton} onPress={openPairModal}>
            <Text style={styles.pairButtonText}>Pair Sensor</Text>
          </TouchableOpacity>
        </View>

        {/* Pair Modal */}
        <Modal visible={pairModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Pair Sensor</Text>
              <Text style={styles.modalLabel}>
                Enter a password (1-8 hex digits) to secure this sensor. 
                You'll need this password if you ever want to use a different sensor.
              </Text>
              <TextInput
                style={styles.modalInput}
                value={pairPassword}
                onChangeText={setPairPassword}
                placeholder="e.g. 12345678"
                autoCapitalize="characters"
                autoFocus
                maxLength={8}
                onSubmitEditing={handlePair}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setPairModalVisible(false)}
                  disabled={pairing}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSave}
                  onPress={handlePair}
                  disabled={pairing}
                >
                  {pairing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveText}>Pair</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Pair Options Modal */}
        <Modal visible={pairOptionsVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Sensor Pairing</Text>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={handleChangePassword}
              >
                <Text style={styles.optionButtonText}>Change Password</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, styles.optionButtonDestructive]}
                onPress={handleUnpairOption}
              >
                <Text style={styles.optionButtonTextDestructive}>Unpair Sensor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setPairOptionsVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Unpair Confirm Modal */}
        <Modal visible={unpairConfirmVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Unpair Sensor</Text>
              <Text style={styles.modalLabel}>
                This will reset the sensor password to default. Anyone will be able to connect to this sensor until you pair it again.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setUnpairConfirmVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSave, styles.modalDestructive]}
                  onPress={confirmUnpair}
                >
                  <Text style={styles.modalSaveText}>Unpair</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {fingerprints.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>👆</Text>
          <Text style={styles.emptyTitle}>No Fingerprints</Text>
          <Text style={styles.emptyText}>
            Tap + to enroll a new fingerprint.
          </Text>
        </View>
      ) : (
        <FlatList
          data={fingerprints}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardId}>ID {item.id}</Text>
              </View>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => openRenameModal(item)}
              >
                <Text style={styles.actionText}>Rename</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.copyButton]}
                onPress={() => openCopyModal(item)}
              >
                <Text style={styles.actionText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete(item)}
              >
                <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={[styles.fab, { bottom: 32 + insets.bottom }]} onPress={openEnrollModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {sensorPaired && (
        <TouchableOpacity 
          style={[styles.unpairButton, { bottom: 100 + insets.bottom }]} 
          onPress={handlePairingOptions}
        >
          <Text style={styles.unpairText}>🔓</Text>
        </TouchableOpacity>
      )}

      {/* Rename Modal */}
      <Modal visible={renameModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Rename Fingerprint</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="New name"
              autoFocus
              onSubmitEditing={handleRename}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleRename}>
                <Text style={styles.modalSaveText}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Enroll Modal */}
      <Modal visible={enrollModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Enroll New Fingerprint</Text>
            {!enrolling ? (
              <>
                <Text style={styles.modalLabel}>
                  Next available ID: {getNextId()}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={enrollName}
                  onChangeText={setEnrollName}
                  placeholder="Name for this fingerprint"
                  autoFocus
                  onSubmitEditing={handleEnroll}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => setEnrollModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSave}
                    onPress={handleEnroll}
                  >
                    <Text style={styles.modalSaveText}>Start</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <ActivityIndicator
                  size="large"
                  color="#4a90d9"
                  style={{ marginVertical: 16 }}
                />
                <Text style={styles.enrollStatusText}>{enrollStatus}</Text>
                <TouchableOpacity
                  style={[styles.modalCancel, { marginTop: 20, alignSelf: 'center' }]}
                  onPress={handleCancelEnroll}
                >
                  <Text style={styles.deleteText}>Cancel Enrollment</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Delete Fingerprint</Text>
            <Text style={styles.modalLabel}>
              Are you sure you want to delete "{deleteTarget?.name}" (ID {deleteTarget?.id})?
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

      {/* Copy Modal */}
      <Modal visible={copyModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Copy Fingerprint</Text>
            {!copying ? (
              <>
                <Text style={styles.modalLabel}>
                  Copy "{copyTarget?.name}" to another sensor:
                </Text>
                {otherSensors.length === 0 ? (
                  <Text style={styles.noSensorsText}>
                    No other sensors configured.
                  </Text>
                ) : (
                  <ScrollView style={styles.sensorList}>
                    {otherSensors.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.sensorOption}
                        onPress={() => handleCopyTo(s)}
                      >
                        <Text style={styles.sensorOptionName}>{s.name}</Text>
                        <Text style={styles.sensorOptionIp}>{s.ipAddress}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <TouchableOpacity
                  style={[styles.modalCancel, { marginTop: 16, alignSelf: 'center' }]}
                  onPress={() => setCopyModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator
                  size="large"
                  color="#4a90d9"
                  style={{ marginVertical: 16 }}
                />
                <Text style={styles.enrollStatusText}>{copyStatus}</Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Pair Options Modal */}
      <Modal visible={pairOptionsVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Sensor Pairing</Text>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleChangePassword}
            >
              <Text style={styles.optionButtonText}>Change Password</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, styles.optionButtonDestructive]}
              onPress={handleUnpairOption}
            >
              <Text style={styles.optionButtonTextDestructive}>Unpair Sensor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setPairOptionsVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Unpair Confirm Modal */}
      <Modal visible={unpairConfirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Unpair Sensor</Text>
            <Text style={styles.modalLabel}>
              This will reset the sensor password to default. Anyone will be able to connect to this sensor until you pair it again.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setUnpairConfirmVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, styles.modalDestructive]}
                onPress={confirmUnpair}
              >
                <Text style={styles.modalSaveText}>Unpair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={pairModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Change Sensor Password</Text>
            <Text style={styles.modalLabel}>
              Enter a new password (1-8 hex digits) to secure this sensor.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={pairPassword}
              onChangeText={setPairPassword}
              placeholder="e.g. 12345678"
              autoCapitalize="characters"
              autoFocus
              maxLength={8}
              onSubmitEditing={handlePair}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setPairModalVisible(false)}
                disabled={pairing}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={handlePair}
                disabled={pairing}
              >
                {pairing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { padding: 16 },
  backButton: { paddingHorizontal: 12, paddingVertical: 8 },
  backArrow: { fontSize: 24, color: '#333' },
  loadingText: { marginTop: 12, color: '#888', fontSize: 14 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  errorText: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 20 },
  retryButton: {
    backgroundColor: '#4a90d9',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#333' },
  cardId: { fontSize: 12, color: '#aaa', marginTop: 2 },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e8e8e8',
    marginLeft: 8,
  },
  deleteButton: { backgroundColor: '#fde8e8' },
  copyButton: { backgroundColor: '#e8f4e8' },
  actionText: { fontSize: 13, color: '#555', fontWeight: '500' },
  deleteText: { color: '#d9534f', fontWeight: '500' },
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
  modalLabel: { fontSize: 14, color: '#888', marginBottom: 12 },
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
  enrollStatusText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
  },
  noSensorsText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 16,
  },
  sensorList: {
    maxHeight: 200,
  },
  sensorOption: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  sensorOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  sensorOptionIp: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  pairIcon: { fontSize: 48, marginBottom: 16 },
  pairTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  pairText: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 24, paddingHorizontal: 16 },
  pairButton: {
    backgroundColor: '#4a90d9',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  pairButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  unpairButton: {
    position: 'absolute',
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  unpairText: { fontSize: 20 },
  optionButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  optionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  optionButtonDestructive: {
    backgroundColor: '#fff5f5',
  },
  optionButtonTextDestructive: {
    fontSize: 16,
    fontWeight: '500',
    color: '#d9534f',
  },
  modalDestructive: {
    backgroundColor: '#d9534f',
  },
});
