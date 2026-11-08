import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, List, Divider, Snackbar } from 'react-native-paper';
import { chat } from '../api/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const addMessage = (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input };
    addMessage(userMsg);
    setInput('');
    setLoading(true);
    try {
      const res = await chat([...messages, userMsg]);
      const assistantMsg: Message = { role: 'assistant', content: res.reply as string };
      addMessage(assistantMsg);
    } catch (e) {
      setSnackbarMsg('Chat error: ' + (e as Error).message);
      setSnackbarVisible(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // scroll to bottom when messages change
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <List.Item
            title={item.content}
            titleNumberOfLines={10}
            style={item.role === 'assistant' ? styles.assistant : styles.user}
          />
        )}
        ItemSeparatorComponent={() => <Divider />}
      />
      <View style={styles.inputRow}>
        <TextInput
          placeholder="Ask something…"
          value={input}
          onChangeText={setInput}
          style={styles.input}
          disabled={loading}
        />
        <Button mode="contained" onPress={sendMessage} disabled={loading || !input.trim()} style={styles.sendBtn}>
          Send
        </Button>
      </View>
      <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={3000}>
        {snackbarMsg}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080B0A' },
  user: { backgroundColor: '#111713', marginHorizontal: 8, marginVertical: 4, borderRadius: 4 },
  assistant: { backgroundColor: '#182019', marginHorizontal: 8, marginVertical: 4, borderRadius: 4 },
  inputRow: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderTopColor: '#182019' },
  input: { flex: 1, marginRight: 8 },
  sendBtn: { alignSelf: 'center' },
});
