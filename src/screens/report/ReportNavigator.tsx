/**
 * File: src/screens/report/ReportNavigator.js
 * Purpose: Manages the navigation stack for the Report Card module.
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import ClassListScreen from './ClassListScreen';
import MarksEntryScreen from './MarksEntryScreen';
import StudentReportCardScreen from './StudentReportCardScreen';
import TeacherAssignmentScreen from './TeacherAssignmentScreen';

const Stack = createStackNavigator();

// Navigator for Teacher and Admin roles
const ReportNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#2c3e50' },
                headerTintColor: '#ffffff',
                headerTitleStyle: { fontWeight: 'bold' },
            }}
        >
            <Stack.Screen 
                name="ReportClassList" 
                component={ClassListScreen} 
                options={{ title: 'Select Class for Report Card' }} 
            />
            <Stack.Screen 
                name="MarksEntry" 
                component={MarksEntryScreen} 
                options={({ route }) => ({ title: `${route.params.classGroup} - Report Card` })}
            />
            <Stack.Screen 
                name="TeacherAssignment" 
                component={TeacherAssignmentScreen} 
                options={({ route }) => ({ title: `${route.params.classGroup} - Assign Teachers` })}
            />
        </Stack.Navigator>
    );
};

// Navigator for Student role
export const StudentReportNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#2c3e50' },
                headerTintColor: '#ffffff',
                headerTitleStyle: { fontWeight: 'bold' },
            }}
        >
            <Stack.Screen
                name="StudentReportCard"
                component={StudentReportCardScreen}
                options={{ title: 'My Progress Report' }}
            />
        </Stack.Navigator>
    );
};

export default ReportNavigator;
