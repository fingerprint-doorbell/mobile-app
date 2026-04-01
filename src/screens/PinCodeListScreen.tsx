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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PinCode, PinCodeStatus } from '../types';
import {
  listPinCodes,
  getPinCodeStatus,
  addPinCode,
  deletePinCode,
  deleteAllPinCodes,
  renamePinCode,
  updatePinCode,
} from '../services/api';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'PinCodeList'>;

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

export default function PinCodeListScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { sensor } = route.params;
  const [pinCodes, setPinCodes] = useState<PinCode[]>([]);
  const [status, setStatus] = useState<PinCodeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PinCode | null>(null);

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<PinCode | null>(null);
  const [newName, setNewName] = useState('');

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCode, setAddCode] = useState('');
  const [adding, setAdding] = useState(false);

  const [editCodeModalVisible, setEditCodeModalVisible] = useState(false);
  const [editCodeTarget, setEditCodeTarget] = useState<PinCode | null>(null);
  const [newCode, setNewCode] = useState('');

  useEscapeKey(deleteModalVisible, () => setDeleteModalVisible(false));
  useEscapeKey(renameModalVisible, () => setRenameModalVisible(false));
  useEscapeKey(addModalVisible, () => setAddModalVisible(false));
  useEscapeKey(editCodeModalVisible, () => setEditCodeModalVisible(false));

  React.useEffect(() => {
    navigation.setOptions({
      title: `${sensor.name} - PIN Codes`,
      headerLeft: Platform.OS === 'web' ? () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      ) : undefined,
    });
  }, [sensor.name, navigation]);

  const fetchPinCodes = useCallback(async () => {
    try {
      setError(null);
      const [pinStatus, data] = await Promise.all([
        getPinCodeStatus(sensor),
        listPinCodes(sensor),
      ]);
      setStatus(pinStatus);
      setPinCodes(data);
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
      fetchPinCodes();
    }, [fetchPinCodes]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPinCodes();
  };

  const handleDelete = (pc: PinCode) => {
    setDeleteTarget(pc);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePinCode(sensor, deleteTarget.id);
      setPinCodes((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteModalVisible(false);
      setDeleteTarget(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const openRenameModal = (pc: PinCode) => {
    setRenameTarget(pc);
    setNewName(pc.name);
    setRenameModalVisible(true);
  };

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;
    try {
      await renamePinCode(sensor, renameTarget.id, newName.trim());
      setPinCodes((prev) =>
        prev.map((p) =>
          p.id === renameTarget.id ? { ...p, name: newName.trim() } : p,
        ),
      );
      setRenameModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const openEditCodeModal = (pc: PinCode) => {
    setEditCodeTarget(pc);
    setNewCode('');
    setEditCodeModalVisible(true);
  };

  const handleEditCode = async () => {
    if (!editCodeTarget || !newCode.trim()) return;
    if (newCode.length < 4 || newCode.length > 10) {
      Alert.alert('Error', 'PIN code must be 4-10 digits');
      return;
    }
    if (!/^\d+$/.test(newCode)) {
      Alert.alert('Error', 'PIN code must contain only digits 0-9');
      return;
    }
    try {
      await updatePinCode(sensor, editCodeTarget.id, newCode);
      setEditCodeModalVisible(false);
      Alert.alert('Success', 'PIN code updated');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const getNextId = (): number => {
    if (pinCodes.length === 0) return 1;
    const usedIds = new Set(pinCodes.map((p) => p.id));
    let nextId = 1;
    while (usedIds.has(nextId)) {
      nextId++;
    }
    return nextId;
  };

  const openAddModal = () => {
    setAddName('');
    setAddCode('');
    setAdding(false);
    setAddModalVisible(true);
  };

  const handleAdd = async () => {
    if (!addName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    if (!addCode.trim()) {
      Alert.alert('Error', 'Please enter a PIN code');
      return;
    }
    if (addCode.length < 4 || addCode.length > 10) {
      Alert.alert('Error', 'PIN code must be 4-10 digits');
      return;
    }
    if (!/^\d+$/.test(addCode)) {
      Alert.alert('Error', 'PIN code must contain only digits 0-9');
      return;
    }

    const nextId = getNextId();
    setAdding(true);

    try {
      await addPinCode(sensor, nextId, addCode, addName.trim());
      setPinCodes((prev) => [...prev, { id: nextId, name: addName.trim() }]);
      setAddModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4a90d9" />
        <Text style={styles.loadingText}>Loading PIN codes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchPinCodes(); }}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status && !status.enabled) {
    return (
      <View style={styles.center}>
        <Text style={styles.disabledIcon}>⌨️</Text>
        <Text style={styles.disabledTitle}>Keypad Not Configured</Text>
        <Text style={styles.disabledText}>
          The keypad is not enabled on this sensor. Configure keypad pins in ESPHome to use PIN codes.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {pinCodes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔢</Text>
          <Text style={styles.emptyTitle}>No PIN Codes</Text>
          <Text style={styles.emptyText}>
            Tap + to add a new PIN code.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pinCodes}
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
                style={[styles.actionButton, styles.editButton]}
                onPress={() => openEditCodeModal(item)}
              >
                <Text style={styles.actionText}>Change</Text>
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

      <TouchableOpacity style={[styles.fab, { bottom: 32 + insets.bottom }]} onPress={openAddModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add PIN Code</Text>
            <Text style={styles.modalLabel}>Next available ID: {getNextId()}</Text>
            <TextInput
              style={styles.modalInput}
              value={addName}
              onChangeText={setAddName}
              placeholder="Name (e.g. John)"
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { marginTop: 12 }]}
              value={addCode}
              onChangeText={setAddCode}
              placeholder="PIN code (4-10 digits)"
              keyboardType="numeric"
              maxLength={10}
              secureTextEntry
              onSubmitEditing={handleAdd}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setAddModalVisible(false)}
                disabled={adding}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSave}
                onPress={handleAdd}
                disabled={adding}
              >
                {adding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal visible={renameModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Rename PIN Code</Text>
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

      {/* Edit Code Modal */}
      <Modal visible={editCodeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Change PIN Code</Text>
            <Text style={styles.modalLabel}>
              Enter new PIN for "{editCodeTarget?.name}"
            </Text>
            <TextInput
              style={styles.modalInput}
              value={newCode}
              onChangeText={setNewCode}
              placeholder="New PIN code (4-10 digits)"
              keyboardType="numeric"
              maxLength={10}
              secureTextEntry
              autoFocus
              onSubmitEditing={handleEditCode}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditCodeModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleEditCode}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Delete PIN Code</Text>
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
  disabledIcon: { fontSize: 48, marginBottom: 16 },
  disabledTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 8 },
  disabledText: { fontSize: 14, color: '#888', textAlign: 'center', paddingHorizontal: 16 },
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e8e8e8',
    marginLeft: 6,
  },
  deleteButton: { backgroundColor: '#fde8e8' },
  editButton: { backgroundColor: '#fff8e8' },
  actionText: { fontSize: 12, color: '#555', fontWeight: '500' },
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
});
