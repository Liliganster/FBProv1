// Test manual para verificar la detección de duplicados
import { normalizeSignature, isDuplicateTrip } from '../services/tripUtils';
import { Trip, SpecialOrigin } from '../types';

// Función de test para verificar que la detección funcione
export const testDuplicateDetection = () => {
    console.log('=== TESTING DUPLICATE DETECTION ===');
    
    // Crear viajes de prueba
    const existingTrips: Trip[] = [
        {
            id: 'trip-1',
            date: '2024-10-01',
            locations: ['Madrid, España', 'Barcelona, España'],
            distance: 620,
            projectId: 'proj-1',
            reason: 'Reunión de trabajo',
            specialOrigin: SpecialOrigin.HOME,
            passengers: 0
        },
        {
            id: 'trip-2',
            date: '2024-10-02',
            locations: ['Barcelona, España', 'Valencia, España'],
            distance: 350,
            projectId: 'proj-1',
            reason: 'Visita cliente',
            specialOrigin: SpecialOrigin.HOME,
            passengers: 1
        }
    ];
    
    // Test 1: Viaje exactamente igual (debería ser duplicado)
    const duplicateTrip = {
        date: '2024-10-01',
        locations: ['Madrid, España', 'Barcelona, España']
    };
    
    console.log('Test 1 - Viaje duplicado exacto:');
    console.log('Signature original:', normalizeSignature(existingTrips[0].date, existingTrips[0].locations));
    console.log('Signature nuevo:', normalizeSignature(duplicateTrip.date, duplicateTrip.locations));
    console.log('Es duplicado:', isDuplicateTrip(duplicateTrip, existingTrips));
    
    // Test 2: Mismo viaje pero con espacios diferentes (debería ser duplicado)
    const duplicateTripSpaces = {
        date: '2024-10-01',
        locations: ['  Madrid,  España  ', '  Barcelona,  España  ']
    };
    
    console.log('\nTest 2 - Viaje duplicado con espacios:');
    console.log('Signature original:', normalizeSignature(existingTrips[0].date, existingTrips[0].locations));
    console.log('Signature nuevo:', normalizeSignature(duplicateTripSpaces.date, duplicateTripSpaces.locations));
    console.log('Es duplicado:', isDuplicateTrip(duplicateTripSpaces, existingTrips));
    
    // Test 3: Mismo viaje pero con mayúsculas diferentes (debería ser duplicado)
    const duplicateTripCase = {
        date: '2024-10-01',
        locations: ['MADRID, ESPAÑA', 'barcelona, españa']
    };
    
    console.log('\nTest 3 - Viaje duplicado con mayúsculas:');
    console.log('Signature original:', normalizeSignature(existingTrips[0].date, existingTrips[0].locations));
    console.log('Signature nuevo:', normalizeSignature(duplicateTripCase.date, duplicateTripCase.locations));
    console.log('Es duplicado:', isDuplicateTrip(duplicateTripCase, existingTrips));
    
    // Test 4: Viaje diferente fecha (NO debería ser duplicado)
    const differentDateTrip = {
        date: '2024-10-03',
        locations: ['Madrid, España', 'Barcelona, España']
    };
    
    console.log('\nTest 4 - Viaje fecha diferente:');
    console.log('Signature original:', normalizeSignature(existingTrips[0].date, existingTrips[0].locations));
    console.log('Signature nuevo:', normalizeSignature(differentDateTrip.date, differentDateTrip.locations));
    console.log('Es duplicado:', isDuplicateTrip(differentDateTrip, existingTrips));
    
    // Test 5: Viaje ruta diferente (NO debería ser duplicado)
    const differentRouteTrip = {
        date: '2024-10-01',
        locations: ['Madrid, España', 'Sevilla, España']
    };
    
    console.log('\nTest 5 - Viaje ruta diferente:');
    console.log('Signature original:', normalizeSignature(existingTrips[0].date, existingTrips[0].locations));
    console.log('Signature nuevo:', normalizeSignature(differentRouteTrip.date, differentRouteTrip.locations));
    console.log('Es duplicado:', isDuplicateTrip(differentRouteTrip, existingTrips));
    
    console.log('\n=== END TESTS ===');
};