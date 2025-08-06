import React, { useEffect, useState } from 'react';
import ActionCard from './ActionCard';
import { fetchActions } from '../data/actions';

const ActionsSection: React.FC = () => {
  const [actions, setActions] = useState<any[]>([]);

  useEffect(() => {
    const getActions = async () => {
      const data = await fetchActions();
      setActions(data);
    };
    getActions();
  }, []);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {actions.map((action: any) => (
          <ActionCard key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
};

export default ActionsSection;
