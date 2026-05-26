import {
  Document,
  Page,
  Text,
  View,
  StyleSheet
} from '@react-pdf/renderer';
import type { AthleteReport } from './athlete-report-data';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1f2937'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: '#16a34a',
    paddingBottom: 8,
    marginBottom: 16
  },
  brand: { fontSize: 16, fontWeight: 'bold', color: '#16a34a' },
  brandSub: { fontSize: 9, color: '#6b7280' },
  periodText: { fontSize: 9, color: '#6b7280' },
  athleteName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  metaItem: { flexDirection: 'row', gap: 4 },
  metaLabel: { color: '#6b7280' },
  metaValue: { fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#16a34a',
    marginTop: 16,
    marginBottom: 8
  },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 8
  },
  kpiLabel: { fontSize: 8, color: '#6b7280', marginBottom: 2 },
  kpiValue: { fontSize: 14, fontWeight: 'bold' },
  table: { width: '100%', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 9,
    fontWeight: 'bold'
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 6
  },
  cellDate: { width: '18%' },
  cellType: { width: '22%' },
  cellDist: { width: '12%', textAlign: 'right' },
  cellArrows: { width: '12%', textAlign: 'right' },
  cellTotal: { width: '12%', textAlign: 'right' },
  cellAvg: { width: '12%', textAlign: 'right' },
  cellX: { width: '12%', textAlign: 'right' },
  observation: {
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
    marginTop: 6
  },
  observationMeta: { fontSize: 8, color: '#6b7280', marginBottom: 2 },
  observationContent: { fontSize: 10 },
  observationTags: { fontSize: 8, color: '#16a34a', marginTop: 2 },
  empty: {
    fontSize: 9,
    color: '#6b7280',
    fontStyle: 'italic',
    padding: 12,
    textAlign: 'center'
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    fontSize: 8,
    color: '#9ca3af',
    flexDirection: 'row',
    justifyContent: 'space-between'
  }
});

const SESSION_TYPE_LABEL: Record<string, string> = {
  TECHNICAL: 'Técnica',
  SERIES: 'Series',
  COMPETITION_SIM: 'Sim. Comp.',
  WARMUP: 'Calentamiento'
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

type Props = { report: AthleteReport };

export function AthleteReportPDF({ report }: Props) {
  const { athlete, sessions, observations, totals, periodFrom, periodTo } = report;
  const generated = new Date();

  return (
    <Document
      title={`Reporte ${athlete.firstName} ${athlete.lastName}`}
      author="Archery MVP"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Archery MVP</Text>
            <Text style={styles.brandSub}>Reporte de entrenamiento</Text>
          </View>
          <Text style={styles.periodText}>
            {periodFrom ? fmtDate(periodFrom) : '—'} → {periodTo ? fmtDate(periodTo) : '—'}
          </Text>
        </View>

        <Text style={styles.athleteName}>
          {athlete.firstName} {athlete.lastName}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Doc:</Text>
            <Text style={styles.metaValue}>{athlete.documentId}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Modalidad:</Text>
            <Text style={styles.metaValue}>{athlete.bowModality}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Categoría:</Text>
            <Text style={styles.metaValue}>{athlete.category}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Club:</Text>
            <Text style={styles.metaValue}>{athlete.clubName}</Text>
          </View>
          {athlete.coachName && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Coach:</Text>
              <Text style={styles.metaValue}>{athlete.coachName}</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Resumen del período</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Sesiones</Text>
            <Text style={styles.kpiValue}>{totals.sessionCount}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Flechas válidas</Text>
            <Text style={styles.kpiValue}>{totals.arrowsCount}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Promedio/flecha</Text>
            <Text style={styles.kpiValue}>
              {totals.avgPerArrow !== null
                ? totals.avgPerArrow.toFixed(2)
                : '—'}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Xs</Text>
            <Text style={styles.kpiValue}>{totals.xCount}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Sesiones</Text>
        {sessions.length === 0 ? (
          <View style={styles.table}>
            <Text style={styles.empty}>Sin sesiones registradas en el período.</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.cellDate}>Fecha</Text>
              <Text style={styles.cellType}>Tipo</Text>
              <Text style={styles.cellDist}>Dist.</Text>
              <Text style={styles.cellArrows}>Flechas</Text>
              <Text style={styles.cellTotal}>Total</Text>
              <Text style={styles.cellAvg}>Prom.</Text>
              <Text style={styles.cellX}>X</Text>
            </View>
            {sessions.map((s, i) => (
              <View key={`${s.sessionId}-${s.distance}-${i}`} style={styles.tableRow}>
                <Text style={styles.cellDate}>{fmtDate(s.date)}</Text>
                <Text style={styles.cellType}>
                  {(SESSION_TYPE_LABEL[s.type] ?? s.type) + (s.indoor ? ' (indoor)' : '')}
                </Text>
                <Text style={styles.cellDist}>{s.distance}m</Text>
                <Text style={styles.cellArrows}>{s.arrowsCount}</Text>
                <Text style={styles.cellTotal}>{s.total}</Text>
                <Text style={styles.cellAvg}>
                  {s.avg !== null ? s.avg.toFixed(2) : '—'}
                </Text>
                <Text style={styles.cellX}>{s.xCount}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Observaciones del coach</Text>
        {observations.length === 0 ? (
          <Text style={styles.empty}>Sin observaciones en el período.</Text>
        ) : (
          observations.map((o) => (
            <View key={o.id} style={styles.observation}>
              <Text style={styles.observationMeta}>
                {fmtDate(o.createdAt)} · {o.coachName}
              </Text>
              <Text style={styles.observationContent}>{o.content}</Text>
              {o.tags.length > 0 && (
                <Text style={styles.observationTags}>
                  {o.tags.map((t) => `#${t}`).join(' ')}
                </Text>
              )}
            </View>
          ))
        )}

        <View style={styles.footer} fixed>
          <Text>
            Generado el {generated.toLocaleString('es-CO')} por Archery MVP
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
