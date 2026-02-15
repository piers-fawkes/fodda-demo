
import { useState, useEffect } from 'react';
import { dataService } from '../../shared/dataService';

export function useDiscovery(graphId: string, labels: string[]) {
    const [discoveryData, setDiscoveryData] = useState<Record<string, string[]>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const labelsKey = JSON.stringify(labels);

    useEffect(() => {
        async function fetchDiscovery() {
            setIsLoading(true);
            setError(null);
            try {
                // Parse labels back from the key to avoid closure stale issues (though labels is available)
                // or just use labels since we are triggering on key change
                const currentLabels = JSON.parse(labelsKey);
                const results = await Promise.all(
                    currentLabels.map(async (label: string) => {
                        const values = await dataService.getDiscoveryValues(graphId, label);
                        return { label, values };
                    })
                );

                const newData: Record<string, string[]> = {};
                results.forEach(({ label, values }) => {
                    newData[label] = values;
                });

                setDiscoveryData(newData);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch discovery data');
            } finally {
                setIsLoading(false);
            }
        }

        if (graphId && labelsKey !== '[]') {
            fetchDiscovery();
        }
    }, [graphId, labelsKey]);

    return { discoveryData, isLoading, error };
}
