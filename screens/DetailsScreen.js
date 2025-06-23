import { StyleSheet, Text, View } from 'react-native';

export default function DetailsScreen({ route }) {
  const { session } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Session Details</Text>
      <Text>Start: {new Date(session.start).toLocaleString()}</Text>
      <Text>End: {new Date(session.end).toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 24, marginBottom: 10 },
});
